'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SELECTED_CHALLENGE_COOKIE } from '@/lib/challenge-session'
import type {
  Profile,
  Challenge,
  ChallengeStatus,
  ChallengeWithStats,
  ChallengeDayWithActivities,
  EnrollmentMode,
  EnrollmentStatus,
  ChallengeEnrollmentWithUser,
  ChallengeDeleteSummary,
  ChallengeType,
  CourseAccessMode,
  CourseLesson,
} from '@/lib/types'

function checkDateOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const sA = new Date(startA + 'T00:00:00Z').getTime()
  const eA = sA + (durationA - 1) * 86400000
  const sB = new Date(startB + 'T00:00:00Z').getTime()
  const eB = sB + (durationB - 1) * 86400000

  return !(eA < sB || sA > eB)
}

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Unauthenticated: please sign in')

  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (profError || !profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Administrator privileges required')
  }

  return { supabase, user }
}

/**
 * Fetch all challenges with derived statuses and unique participant counts.
 * Participant count: Members who completed at least one activity in that challenge.
 */
export async function getAdminChallenges(): Promise<ChallengeWithStats[]> {
  try {
    const { supabase } = await assertAdmin()

    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !challenges) {
      console.error('[getAdminChallenges] Error:', error)
      return []
    }

    const results: ChallengeWithStats[] = await Promise.all(
      challenges.map(async (c) => {
        const type: ChallengeType = (c.type as ChallengeType) || 'daily'
        const enrollmentMode: EnrollmentMode = (c.enrollment_mode as EnrollmentMode) || 'open'

        let pendingRequestsCount = 0
        if (enrollmentMode === 'approval') {
          try {
            const { count: pendingCount } = await supabase
              .from('challenge_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('challenge_id', c.id)
              .eq('status', 'pending')
            pendingRequestsCount = pendingCount ?? 0
          } catch {
            pendingRequestsCount = 0
          }
        }

        // Course handling
        if (type === 'course') {
          // Lessons count
          const { count: lessonCount } = await supabase
            .from('course_lessons')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', c.id)

          // Members started
          const { count: startedCount } = await supabase
            .from('course_member_state')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', c.id)

          // Members completed
          const { count: completedCount } = await supabase
            .from('course_member_state')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', c.id)
            .not('completed_at', 'is', null)

          return {
            ...c,
            type: 'course',
            status: 'course' as any,
            current_day: 0,
            end_date: '',
            participant_count: startedCount ?? 0,
            lesson_count: lessonCount ?? 0,
            members_started: startedCount ?? 0,
            members_completed: completedCount ?? 0,
            pending_requests_count: pendingRequestsCount,
            is_published: c.is_published ?? false,
          }
        }

        // Daily Challenge handling
        const startDate = c.start_date || ''
        const duration = c.duration_days || 40
        const tz = c.timezone || 'Africa/Lagos'

        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
        const startStr = startDate
        const endDateTime = new Date(new Date(startDate + 'T00:00:00Z').getTime() + (duration - 1) * 86400000)
        const endStr = endDateTime.toISOString().split('T')[0]

        let status: ChallengeStatus = 'upcoming'
        let currentDay = 0

        if (todayStr < startStr) {
          status = 'upcoming'
          currentDay = 0
        } else if (todayStr > endStr) {
          status = 'completed'
          currentDay = duration + 1
        } else {
          status = 'active'
          const diffDays = Math.floor(
            (new Date(todayStr + 'T00:00:00Z').getTime() - new Date(startStr + 'T00:00:00Z').getTime()) /
              86400000
          )
          currentDay = diffDays + 1
        }

        const { data: cDays } = await supabase
          .from('challenge_days')
          .select('id, activities(id)')
          .eq('challenge_id', c.id)

        let participantCount = 0
        if (cDays && cDays.length > 0) {
          const actIds: string[] = []
          for (const d of cDays) {
            for (const a of (d.activities as { id: string }[] ?? [])) {
              actIds.push(a.id)
            }
          }

          if (actIds.length > 0) {
            const { data: compRows } = await supabase
              .from('activity_completions')
              .select('user_id')
              .in('activity_id', actIds)

            if (compRows) {
              const uniqueUsers = new Set(compRows.map((r) => r.user_id))
              participantCount = uniqueUsers.size
            }
          }
        }

        return {
          ...c,
          type: 'daily',
          enrollment_mode: enrollmentMode,
          status,
          current_day: currentDay,
          end_date: endStr,
          participant_count: participantCount,
          pending_requests_count: pendingRequestsCount,
        }
      })
    )

    return results
  } catch (err) {
    console.error('[getAdminChallenges] Unexpected error:', err)
    return []
  }
}

/**
 * Create a new challenge (Daily Consecration Cycle or Self-Paced Course).
 */
export async function createChallenge(params: {
  name: string
  type?: ChallengeType
  durationDays?: number
  startDate?: string
  timezone?: string
  enrollmentMode?: EnrollmentMode
  description?: string
  accessMode?: CourseAccessMode
  accessEndDate?: string
  accessDays?: number
}): Promise<{
  success: boolean
  error?: string
  challengeId?: string
}> {
  try {
    const { supabase } = await assertAdmin()
    const name = params.name.trim()
    const type: ChallengeType = params.type === 'course' ? 'course' : 'daily'
    const timezone = params.timezone?.trim() || 'Africa/Lagos'
    const enrollmentMode: EnrollmentMode = params.enrollmentMode === 'approval' ? 'approval' : 'open'

    if (!name) return { success: false, error: 'Challenge name cannot be empty.' }

    // ── COURSE CREATION ─────────────────────────────────────────
    if (type === 'course') {
      const accessMode: CourseAccessMode = params.accessMode || 'unlimited'
      let accessEndDate: string | null = null
      let accessDays: number | null = null

      if (accessMode === 'fixed_end') {
        if (!params.accessEndDate || isNaN(new Date(params.accessEndDate).getTime())) {
          return { success: false, error: 'Please specify a valid fixed end date.' }
        }
        accessEndDate = params.accessEndDate.trim()
      } else if (accessMode === 'per_member_days') {
        accessDays = Number(params.accessDays)
        if (isNaN(accessDays) || accessDays < 1) {
          return { success: false, error: 'Please specify valid access days (at least 1 day).' }
        }
      }

      const { data: newCourse, error: insertErr } = await supabase
        .from('challenges')
        .insert({
          name,
          type: 'course',
          is_published: false,
          description: params.description?.trim() || null,
          access_mode: accessMode,
          access_end_date: accessEndDate,
          access_days: accessDays,
          timezone,
          enrollment_mode: enrollmentMode,
          start_date: null,
          duration_days: null,
        })
        .select('id')
        .single()

      if (insertErr || !newCourse) {
        return { success: false, error: insertErr?.message || 'Failed to create course.' }
      }

      revalidatePath('/admin')
      return { success: true, challengeId: newCourse.id }
    }

    // ── DAILY CHALLENGE CREATION ────────────────────────────────
    const durationDays = Number(params.durationDays)
    const startDate = params.startDate?.trim() || ''

    if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
      return { success: false, error: 'Duration must be between 1 and 365 days.' }
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      return { success: false, error: 'Please specify a valid start date.' }
    }

    // 1. Check overlap only against existing DAILY challenges
    const { data: existingChallenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('id, name, duration_days, start_date')
      .eq('type', 'daily')

    if (fetchErr) {
      console.error('[createChallenge] Error fetching existing challenges:', fetchErr)
    }

    if (existingChallenges && existingChallenges.length > 0) {
      for (const ec of existingChallenges) {
        if (ec.start_date && ec.duration_days && checkDateOverlap(startDate, durationDays, ec.start_date, ec.duration_days)) {
          const ecEndDate = new Date(
            new Date(ec.start_date + 'T00:00:00Z').getTime() + (ec.duration_days - 1) * 86400000
          )
            .toISOString()
            .split('T')[0]
          return {
            success: false,
            error: `Challenge dates overlap with existing challenge "${ec.name}" (${ec.start_date} to ${ecEndDate}). Daily challenges cannot overlap in dates.`,
          }
        }
      }
    }

    // 2. Insert new daily challenge
    const { data: newChallenge, error: insertErr } = await supabase
      .from('challenges')
      .insert({
        name,
        type: 'daily',
        duration_days: durationDays,
        start_date: startDate,
        timezone,
        enrollment_mode: enrollmentMode,
      })
      .select('id')
      .single()

    if (insertErr || !newChallenge) {
      return { success: false, error: insertErr?.message || 'Failed to create challenge' }
    }

    const challengeId = newChallenge.id

    // 3. Generate day slots 1 to N with default templates and 3 default activities
    for (let i = 1; i <= durationDays; i++) {
      const { data: dayRow } = await supabase
        .from('challenge_days')
        .insert({
          challenge_id: challengeId,
          day_number: i,
          title: `Day ${i}: Consecration & Spiritual Discipline`,
          description: `Daily devotional focus and prayer alignment for Day ${i} of the ${durationDays} Days of ${name} Challenge.`,
          scripture_reference: 'Galatians 5:16-25 & Romans 8:1-14',
        })
        .select('id')
        .single()

      if (dayRow) {
        await supabase.from('activities').insert([
          {
            challenge_day_id: dayRow.id,
            description: 'Morning Prayer Watch (30 mins personal devotion)',
            sort_order: 1,
          },
          {
            challenge_day_id: dayRow.id,
            description: 'Scripture Meditation & Journaling',
            sort_order: 2,
          },
          {
            challenge_day_id: dayRow.id,
            description: 'Midday Fasting & Fellowship Consecration',
            sort_order: 3,
          },
        ])
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')

    return { success: true, challengeId }
  } catch (err) {
    console.error('[createChallenge] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create challenge',
    }
  }
}

/**
 * Copy days and activities from a previous challenge into a target challenge.
 * Pre-fills the new challenge up to its duration_days.
 */
export async function copyChallengeDays(
  sourceChallengeId: string,
  targetChallengeId: string
): Promise<{ success: boolean; error?: string; copiedCount?: number }> {
  try {
    const { supabase } = await assertAdmin()

    // 1. Fetch source days and activities
    const { data: sourceDays, error: srcErr } = await supabase
      .from('challenge_days')
      .select('id, day_number, title, description, scripture_reference, activities(description, sort_order, video_url)')
      .eq('challenge_id', sourceChallengeId)
      .order('day_number', { ascending: true })

    if (srcErr || !sourceDays || sourceDays.length === 0) {
      return { success: false, error: 'Source challenge has no days to copy.' }
    }

    // 2. Fetch target challenge to verify duration
    const { data: targetChallenge, error: targetErr } = await supabase
      .from('challenges')
      .select('id, duration_days')
      .eq('id', targetChallengeId)
      .single()

    if (targetErr || !targetChallenge) {
      return { success: false, error: 'Target challenge not found.' }
    }

    let copied = 0

    // 3. For each day up to target duration, copy content
    for (const sDay of sourceDays) {
      if (targetChallenge.duration_days && sDay.day_number > targetChallenge.duration_days) continue

      const { data: targetDay, error: dayErr } = await supabase
        .from('challenge_days')
        .upsert(
          {
            challenge_id: targetChallengeId,
            day_number: sDay.day_number,
            title: sDay.title,
            description: sDay.description,
            scripture_reference: sDay.scripture_reference,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'challenge_id,day_number' }
        )
        .select('id')
        .single()

      if (dayErr || !targetDay) {
        console.error(`[copyChallengeDays] Day ${sDay.day_number} error:`, dayErr)
        continue
      }

      // Delete existing activities for targetDay
      await supabase.from('activities').delete().eq('challenge_day_id', targetDay.id)

      // Copy activities
      const actsToInsert = (sDay.activities as { description: string; sort_order: number; video_url?: string | null }[] ?? []).map((a) => ({
        challenge_day_id: targetDay.id,
        description: a.description,
        sort_order: a.sort_order,
        video_url: a.video_url || null,
      }))

      if (actsToInsert.length > 0) {
        await supabase.from('activities').insert(actsToInsert)
      }

      copied++
    }

    revalidatePath('/admin')
    return { success: true, copiedCount: copied }
  } catch (err) {
    console.error('[copyChallengeDays] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to copy challenge days',
    }
  }
}

/**
 * Update challenge details (name, duration, start date, timezone).
 * Validates date range does not overlap another challenge.
 */
/**
 * Update challenge details (name, duration, start date, timezone, enrollment_mode).
 * Validates date range does not overlap another challenge.
 */
export async function updateChallenge(
  challengeId: string,
  params: {
    name: string
    durationDays?: number
    startDate?: string
    timezone?: string
    enrollmentMode?: EnrollmentMode
    description?: string
    accessMode?: CourseAccessMode
    accessEndDate?: string
    accessDays?: number
    isPublished?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const name = params.name.trim()
    const timezone = params.timezone?.trim() || 'Africa/Lagos'

    if (!name) return { success: false, error: 'Challenge name cannot be empty.' }

    // Fetch existing challenge
    const { data: existingChallenge } = await supabase
      .from('challenges')
      .select('id, name, type, duration_days, start_date, enrollment_mode, access_mode')
      .eq('id', challengeId)
      .single()

    if (!existingChallenge) {
      return { success: false, error: 'Challenge not found.' }
    }

    const type: ChallengeType = (existingChallenge.type as ChallengeType) || 'daily'
    const currentMode = existingChallenge.enrollment_mode || 'open'
    const targetMode = params.enrollmentMode || currentMode

    // ── COURSE UPDATE ───────────────────────────────────────────
    if (type === 'course') {
      const accessMode: CourseAccessMode = params.accessMode || existingChallenge.access_mode || 'unlimited'
      let accessEndDate: string | null = null
      let accessDays: number | null = null

      if (accessMode === 'fixed_end') {
        if (params.accessEndDate && isNaN(new Date(params.accessEndDate).getTime())) {
          return { success: false, error: 'Please specify a valid fixed end date.' }
        }
        accessEndDate = params.accessEndDate?.trim() || null
      } else if (accessMode === 'per_member_days') {
        accessDays = Number(params.accessDays)
        if (isNaN(accessDays) || accessDays < 1) {
          return { success: false, error: 'Please specify valid access days (at least 1 day).' }
        }
      }

      const updatePayload: {
        name: string
        timezone: string
        enrollment_mode: EnrollmentMode
        description?: string | null
        access_mode?: CourseAccessMode | null
        access_end_date?: string | null
        access_days?: number | null
        is_published?: boolean
      } = {
        name,
        timezone,
        enrollment_mode: targetMode,
        access_mode: accessMode,
        access_end_date: accessEndDate,
        access_days: accessDays,
        ...(params.description !== undefined ? { description: params.description?.trim() || null } : {}),
        ...(params.isPublished !== undefined ? { is_published: params.isPublished } : {}),
      }

      const { error: updErr } = await supabase
        .from('challenges')
        .update(updatePayload)
        .eq('id', challengeId)

      if (updErr) {
        return { success: false, error: updErr.message }
      }

      revalidatePath('/admin')
      return { success: true }
    }

    // ── DAILY CHALLENGE UPDATE ──────────────────────────────────
    const durationDays = Number(params.durationDays)
    const startDate = params.startDate?.trim() || ''

    if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
      return { success: false, error: 'Duration must be between 1 and 365 days.' }
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      return { success: false, error: 'Please specify a valid start date.' }
    }

    // Check overlap with other DAILY challenges
    const { data: otherChallenges } = await supabase
      .from('challenges')
      .select('id, name, duration_days, start_date')
      .eq('type', 'daily')
      .neq('id', challengeId)

    if (otherChallenges && otherChallenges.length > 0) {
      for (const oc of otherChallenges) {
        if (oc.start_date && oc.duration_days && checkDateOverlap(startDate, durationDays, oc.start_date, oc.duration_days)) {
          const ocEndDate = new Date(
            new Date(oc.start_date + 'T00:00:00Z').getTime() + (oc.duration_days - 1) * 86400000
          )
            .toISOString()
            .split('T')[0]
          return {
            success: false,
            error: `Challenge dates overlap with existing challenge "${oc.name}" (${oc.start_date} to ${ecEndDate(oc.start_date, oc.duration_days)}). Daily challenges cannot overlap in dates.`,
          }
        }
      }
    }

    // If switching Open -> Approval: grandfather existing participants
    if (targetMode === 'approval' && currentMode !== 'approval') {
      try {
        await supabase.rpc('grandfather_existing_participants', { target_challenge_id: challengeId })
      } catch {
        // Fallback: direct query
      }

      const { data: cDays } = await supabase
        .from('challenge_days')
        .select('id, activities(id)')
        .eq('challenge_id', challengeId)

      const actIds: string[] = []
      for (const d of cDays ?? []) {
        for (const a of ((d.activities as { id: string }[]) ?? [])) {
          actIds.push(a.id)
        }
      }

      if (actIds.length > 0) {
        const { data: compRows } = await supabase
          .from('activity_completions')
          .select('user_id')
          .in('activity_id', actIds)

        if (compRows && compRows.length > 0) {
          const uniqueUsers = Array.from(new Set(compRows.map((r) => r.user_id)))
          const enrollRows = uniqueUsers.map((uid) => ({
            challenge_id: challengeId,
            user_id: uid,
            status: 'approved' as const,
            requested_at: new Date().toISOString(),
            decided_at: new Date().toISOString(),
            decided_by: user.id,
          }))

          await supabase
            .from('challenge_enrollments')
            .upsert(enrollRows, { onConflict: 'challenge_id, user_id' })
        }
      }
    }

    // If switching Approval -> Open: resolve leftover pending requests
    if (targetMode === 'open' && currentMode === 'approval') {
      try {
        await supabase
          .from('challenge_enrollments')
          .update({
            status: 'approved',
            decided_at: new Date().toISOString(),
            decided_by: user.id,
          })
          .eq('challenge_id', challengeId)
          .eq('status', 'pending')
      } catch {
        // Ignore if none
      }
    }

    const updatePayload: {
      name: string
      duration_days: number
      start_date: string
      timezone: string
      enrollment_mode?: EnrollmentMode
    } = {
      name,
      duration_days: durationDays,
      start_date: startDate,
      timezone,
      ...(params.enrollmentMode ? { enrollment_mode: params.enrollmentMode } : {}),
    }

    const { error: updErr } = await supabase
      .from('challenges')
      .update(updatePayload)
      .eq('id', challengeId)

    if (updErr) {
      return { success: false, error: updErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')
    revalidatePath('/hub')
    revalidatePath('/challenges')

    return { success: true }
  } catch (err) {
    console.error('[updateChallenge] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update challenge',
    }
  }
}

function ecEndDate(start: string, duration: number): string {
  return new Date(new Date(start + 'T00:00:00Z').getTime() + (duration - 1) * 86400000)
    .toISOString()
    .split('T')[0]
}

// ─────────────────────────────────────────────────────────────
// COURSE MANAGEMENT ACTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Toggle published status of a course.
 * Publishing requires at least one lesson with at least one content block.
 */
export async function toggleCoursePublished(
  courseId: string
): Promise<{ success: boolean; isPublished?: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    // 1. Fetch current status
    const { data: course, error: fetchErr } = await supabase
      .from('challenges')
      .select('id, name, type, is_published')
      .eq('id', courseId)
      .single()

    if (fetchErr || !course) {
      return { success: false, error: 'Course not found.' }
    }

    const willPublish = !course.is_published

    // 2. If publishing, validate lesson and block requirements
    if (willPublish) {
      const { data: lessons, error: lessErr } = await supabase
        .from('course_lessons')
        .select('id')
        .eq('challenge_id', courseId)

      if (lessErr || !lessons || lessons.length === 0) {
        return {
          success: false,
          error: 'Cannot publish course: Course must have at least one lesson before publishing.',
        }
      }

      const lessonIds = lessons.map((l) => l.id)
      const { count: blocksCount } = await supabase
        .from('course_blocks')
        .select('*', { count: 'exact', head: true })
        .in('lesson_id', lessonIds)

      if (!blocksCount || blocksCount === 0) {
        return {
          success: false,
          error: 'Cannot publish course: Course lessons must contain at least one content block before publishing.',
        }
      }
    }

    // 3. Update status
    const { error: updErr } = await supabase
      .from('challenges')
      .update({ is_published: willPublish })
      .eq('id', courseId)

    if (updErr) {
      return { success: false, error: updErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/hub')
    revalidatePath('/challenges')
    return { success: true, isPublished: willPublish }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle course published status',
    }
  }
}

/**
 * Fetch all lessons for a course ordered by position ASC.
 */
export async function getCourseLessons(
  courseId: string
): Promise<{ success: boolean; lessons: CourseLesson[]; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    const { data: lessons, error } = await supabase
      .from('course_lessons')
      .select('*')
      .eq('challenge_id', courseId)
      .order('position', { ascending: true })

    if (error) {
      return { success: false, lessons: [], error: error.message }
    }

    const lessonsWithCounts = await Promise.all(
      (lessons ?? []).map(async (l) => {
        const [blockRes, compRes] = await Promise.all([
          supabase
            .from('course_blocks')
            .select('*', { count: 'exact', head: true })
            .eq('lesson_id', l.id),
          supabase
            .from('course_lesson_completions')
            .select('*', { count: 'exact', head: true })
            .eq('lesson_id', l.id),
        ])

        return {
          ...l,
          block_count: blockRes.count ?? 0,
          completed_count: compRes.count ?? 0,
        }
      })
    )

    return { success: true, lessons: lessonsWithCounts }
  } catch (err) {
    return {
      success: false,
      lessons: [],
      error: err instanceof Error ? err.message : 'Failed to fetch course lessons',
    }
  }
}

/**
 * Create a new lesson at the end of a course.
 */
export async function createCourseLesson(
  courseId: string,
  params: { title: string; summary?: string }
): Promise<{ success: boolean; lesson?: CourseLesson; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const title = params.title.trim()
    if (!title) return { success: false, error: 'Lesson title cannot be empty.' }

    // 1. Get current maximum position
    const { data: maxLesson } = await supabase
      .from('course_lessons')
      .select('position')
      .eq('challenge_id', courseId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPos = (maxLesson?.position ?? 0) + 1

    // 2. Insert new lesson
    const { data: newLesson, error: insErr } = await supabase
      .from('course_lessons')
      .insert({
        challenge_id: courseId,
        position: nextPos,
        title,
        summary: params.summary?.trim() || null,
      })
      .select('*')
      .single()

    if (insErr || !newLesson) {
      return { success: false, error: insErr?.message || 'Failed to create lesson.' }
    }

    revalidatePath('/admin')
    return {
      success: true,
      lesson: { ...newLesson, block_count: 0, completed_count: 0 },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create course lesson',
    }
  }
}

/**
 * Update an existing lesson's title and summary.
 */
export async function updateCourseLesson(
  lessonId: string,
  params: { title: string; summary?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const title = params.title.trim()
    if (!title) return { success: false, error: 'Lesson title cannot be empty.' }

    const { error: updErr } = await supabase
      .from('course_lessons')
      .update({
        title,
        summary: params.summary?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lessonId)

    if (updErr) {
      return { success: false, error: updErr.message }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update course lesson',
    }
  }
}

/**
 * Delete a lesson from a course and re-sequence remaining positions.
 */
export async function deleteCourseLesson(
  lessonId: string
): Promise<{ success: boolean; affectedMembersCount?: number; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    // 1. Fetch lesson to know challenge_id and position
    const { data: lesson, error: fetchErr } = await supabase
      .from('course_lessons')
      .select('id, challenge_id, position')
      .eq('id', lessonId)
      .single()

    if (fetchErr || !lesson) {
      return { success: false, error: 'Lesson not found.' }
    }

    // 2. Count affected members who completed this lesson
    const { count: completedCount } = await supabase
      .from('course_lesson_completions')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)

    // 3. Delete lesson (cascades to blocks and completions)
    const { error: delErr } = await supabase
      .from('course_lessons')
      .delete()
      .eq('id', lessonId)

    if (delErr) {
      return { success: false, error: delErr.message }
    }

    // 4. Re-sequence remaining lessons
    const { data: remainingLessons } = await supabase
      .from('course_lessons')
      .select('id, position')
      .eq('challenge_id', lesson.challenge_id)
      .order('position', { ascending: true })

    if (remainingLessons) {
      for (let i = 0; i < remainingLessons.length; i++) {
        if (remainingLessons[i].position !== i + 1) {
          await supabase
            .from('course_lessons')
            .update({ position: i + 1 })
            .eq('id', remainingLessons[i].id)
        }
      }
    }

    revalidatePath('/admin')
    return { success: true, affectedMembersCount: completedCount ?? 0 }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete course lesson',
    }
  }
}

/**
 * Reorder lessons in a course.
 */
export async function reorderCourseLessons(
  courseId: string,
  orderedLessonIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    // Shift to negative temporary positions first to prevent unique constraint collisions
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await supabase
        .from('course_lessons')
        .update({ position: -(i + 1) })
        .eq('id', orderedLessonIds[i])
    }

    // Assign final 1-indexed positive positions
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await supabase
        .from('course_lessons')
        .update({ position: i + 1 })
        .eq('id', orderedLessonIds[i])
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder lessons',
    }
  }
}

/**
 * Get member completion count for a lesson before deletion or reordering.
 */
export async function getCourseLessonProgressStats(
  lessonId: string
): Promise<{ count: number; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const { count } = await supabase
      .from('course_lesson_completions')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)

    return { count: count ?? 0 }
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed to get stats' }
  }
}

/**
 * Extend a member's access to a course (sets access_override_until).
 */
export async function extendMemberCourseAccess(params: {
  courseId: string
  userId: string
  overrideUntil: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    if (!params.overrideUntil || isNaN(new Date(params.overrideUntil).getTime())) {
      return { success: false, error: 'Please provide a valid extension date.' }
    }

    const { error } = await supabase
      .from('course_member_state')
      .upsert(
        {
          challenge_id: params.courseId,
          user_id: params.userId,
          access_override_until: new Date(params.overrideUntil).toISOString(),
        },
        { onConflict: 'challenge_id, user_id' }
      )

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to extend member course access',
    }
  }
}

/**
 * Get count of members who would be grandfathered in if an open challenge is switched to approval.
 */
export async function getGrandfatheredParticipantsCount(
  challengeId: string
): Promise<{ count: number; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
    const { data: cDays } = await supabase
      .from('challenge_days')
      .select('id, activities(id)')
      .eq('challenge_id', challengeId)

    if (!cDays || cDays.length === 0) return { count: 0 }

    const actIds: string[] = []
    for (const d of cDays) {
      for (const a of ((d.activities as { id: string }[]) ?? [])) {
        actIds.push(a.id)
      }
    }

    if (actIds.length === 0) return { count: 0 }

    const { data: compRows } = await supabase
      .from('activity_completions')
      .select('user_id')
      .in('activity_id', actIds)

    if (!compRows || compRows.length === 0) return { count: 0 }

    const uniqueUsers = new Set(compRows.map((r) => r.user_id))
    return { count: uniqueUsers.size }
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed to get count' }
  }
}

/**
 * Fetch all join requests and enrolled members for a specific challenge.
 */
export async function getChallengeEnrollments(challengeId: string): Promise<{
  success: boolean
  pending: ChallengeEnrollmentWithUser[]
  enrolled: ChallengeEnrollmentWithUser[]
  error?: string
}> {
  try {
    const { supabase } = await assertAdmin()
    const { data: rows, error } = await supabase
      .from('challenge_enrollments')
      .select('*, profiles:user_id(id, full_name, email, avatar_url, display_tag, fellowship_unit)')
      .eq('challenge_id', challengeId)
      .order('requested_at', { ascending: false })

    if (error) {
      return { success: false, pending: [], enrolled: [], error: error.message }
    }

    const typedRows = (rows ?? []) as unknown as ChallengeEnrollmentWithUser[]
    const pending = typedRows.filter((r) => r.status === 'pending')
    const enrolled = typedRows.filter((r) => r.status === 'approved')

    // If challenge is a course, enrich enrolled members with course progress & access override
    const { data: chal } = await supabase
      .from('challenges')
      .select('type')
      .eq('id', challengeId)
      .maybeSingle()

    if (chal?.type === 'course' && enrolled.length > 0) {
      const userIds = enrolled.map((e) => e.user_id)
      const [{ data: memberStates }, { count: totalLessons }, { data: completions }] =
        await Promise.all([
          supabase
            .from('course_member_state')
            .select('user_id, started_at, access_override_until, completed_at')
            .eq('challenge_id', challengeId)
            .in('user_id', userIds),
          supabase
            .from('course_lessons')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', challengeId),
          supabase
            .from('course_lesson_completions')
            .select('user_id, course_lessons!inner(challenge_id)')
            .eq('course_lessons.challenge_id', challengeId)
            .in('user_id', userIds),
        ])

      const stateMap = new Map((memberStates ?? []).map((s) => [s.user_id, s]))
      const compMap = new Map<string, number>()
      for (const c of (completions ?? []) as { user_id: string }[]) {
        compMap.set(c.user_id, (compMap.get(c.user_id) ?? 0) + 1)
      }

      for (const e of enrolled) {
        const s = stateMap.get(e.user_id)
        e.course_member_state = {
          started_at: s?.started_at ?? null,
          access_override_until: s?.access_override_until ?? null,
          completed_at: s?.completed_at ?? null,
          completed_lessons_count: compMap.get(e.user_id) ?? 0,
          total_lessons_count: totalLessons ?? 0,
        }
      }
    }

    return { success: true, pending, enrolled }
  } catch (err) {
    return {
      success: false,
      pending: [],
      enrolled: [],
      error: err instanceof Error ? err.message : 'Failed to fetch enrollments',
    }
  }
}

/**
 * Decide a single challenge enrollment request (approve or reject).
 */
export async function decideChallengeEnrollment(params: {
  enrollmentId: string
  status: 'approved' | 'rejected'
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const { error } = await supabase
      .from('challenge_enrollments')
      .update({
        status: params.status,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq('id', params.enrollmentId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    revalidatePath('/hub')
    revalidatePath('/challenges')
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update enrollment',
    }
  }
}

/**
 * Decide all pending enrollment requests for a challenge (one-tap Approve All).
 */
export async function decideAllPendingEnrollments(params: {
  challengeId: string
  status: 'approved' | 'rejected'
}): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const { data, error } = await supabase
      .from('challenge_enrollments')
      .update({
        status: params.status,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq('challenge_id', params.challengeId)
      .eq('status', 'pending')
      .select('id')

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    revalidatePath('/hub')
    revalidatePath('/challenges')
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    return { success: true, count: data?.length ?? 0 }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decide enrollments',
    }
  }
}

/**
 * Remove an enrolled member from a challenge (set back to rejected).
 */
export async function removeEnrolledMember(params: {
  enrollmentId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const { error } = await supabase
      .from('challenge_enrollments')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq('id', params.enrollmentId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    revalidatePath('/hub')
    revalidatePath('/challenges')
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove member from challenge',
    }
  }
}

/**
 * Fetch exact summary of items that will be permanently destroyed when deleting a challenge.
 */
export async function getChallengeDeleteSummary(challengeId: string): Promise<{
  success: boolean
  summary?: ChallengeDeleteSummary
  error?: string
}> {
  try {
    const { supabase } = await assertAdmin()

    // Try RPC first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_challenge_delete_summary', {
      target_challenge_id: challengeId,
    })

    if (!rpcErr && rpcData) {
      return { success: true, summary: rpcData as unknown as ChallengeDeleteSummary }
    }

    // Fallback: direct calculation
    const { data: challenge, error: chalErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (chalErr || !challenge) {
      return { success: false, error: 'Challenge not found' }
    }

    const { count: enrollCount } = await supabase
      .from('challenge_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    if (challenge.type === 'course') {
      const { count: lessonsCount } = await supabase
        .from('course_lessons')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)

      const { data: cLessons } = await supabase
        .from('course_lessons')
        .select('id')
        .eq('challenge_id', challengeId)

      const lessonIds = (cLessons ?? []).map((l) => l.id)
      let blocksCount = 0
      let lessonCompsCount = 0

      if (lessonIds.length > 0) {
        const [bRes, compRes] = await Promise.all([
          supabase
            .from('course_blocks')
            .select('*', { count: 'exact', head: true })
            .in('lesson_id', lessonIds),
          supabase
            .from('course_lesson_completions')
            .select('*', { count: 'exact', head: true })
            .in('lesson_id', lessonIds),
        ])
        blocksCount = bRes.count ?? 0
        lessonCompsCount = compRes.count ?? 0
      }

      const { count: startedCount } = await supabase
        .from('course_member_state')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)

      const summary: ChallengeDeleteSummary = {
        id: challenge.id,
        name: challenge.name,
        type: 'course',
        status: 'course',
        days_count: 0,
        activities_count: 0,
        participants_count: startedCount ?? 0,
        completions_count: lessonCompsCount,
        activity_completions_count: 0,
        journal_entries_count: 0,
        enrollments_count: enrollCount ?? 0,
        lessons_count: lessonsCount ?? 0,
        blocks_count: blocksCount,
        members_started: startedCount ?? 0,
      }

      return { success: true, summary }
    }

    // Daily Challenge fallback
    const { data: cDays } = await supabase
      .from('challenge_days')
      .select('id, activities(id)')
      .eq('challenge_id', challengeId)

    const dayIds = (cDays ?? []).map((d) => d.id)
    const actIds: string[] = []
    for (const d of cDays ?? []) {
      for (const a of ((d.activities as { id: string }[]) ?? [])) {
        actIds.push(a.id)
      }
    }

    let completionsCount = 0
    let actCompsCount = 0
    let distinctParticipants = 0

    if (dayIds.length > 0) {
      const { count: cCount } = await supabase
        .from('completions')
        .select('*', { count: 'exact', head: true })
        .in('challenge_day_id', dayIds)
      completionsCount = cCount ?? 0
    }

    if (actIds.length > 0) {
      const { count: acCount } = await supabase
        .from('activity_completions')
        .select('*', { count: 'exact', head: true })
        .in('activity_id', actIds)
      actCompsCount = acCount ?? 0

      const { data: compRows } = await supabase
        .from('activity_completions')
        .select('user_id')
        .in('activity_id', actIds)

      if (compRows) {
        distinctParticipants = new Set(compRows.map((r) => r.user_id)).size
      }
    }

    let journalCount = 0
    if (dayIds.length > 0) {
      const { count: jCount } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .in('challenge_day_id', dayIds)
      journalCount = jCount ?? 0
    }

    const tz = challenge.timezone || 'Africa/Lagos'
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    const cStartDate = challenge.start_date || '2026-01-01'
    const cDuration = challenge.duration_days ?? 40
    const endStr = new Date(
      new Date(cStartDate + 'T00:00:00Z').getTime() + (cDuration - 1) * 86400000
    )
      .toISOString()
      .split('T')[0]

    const status: ChallengeStatus =
      todayStr < cStartDate ? 'upcoming' : todayStr > endStr ? 'completed' : 'active'

    const summary: ChallengeDeleteSummary = {
      id: challenge.id,
      name: challenge.name,
      type: 'daily',
      status,
      days_count: dayIds.length,
      activities_count: actIds.length,
      participants_count: distinctParticipants,
      completions_count: completionsCount + actCompsCount,
      activity_completions_count: actCompsCount,
      journal_entries_count: journalCount,
      enrollments_count: enrollCount ?? 0,
    }

    return { success: true, summary }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get delete summary',
    }
  }
}

/**
 * Permanently delete a challenge with atomic cascading through all child tables.
 * Requires typing exact challenge title.
 */
export async function deleteChallenge(
  challengeId: string,
  confirmedName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    // 1. Verify exact name match
    const { data: challenge, error: fetchErr } = await supabase
      .from('challenges')
      .select('id, name')
      .eq('id', challengeId)
      .single()

    if (fetchErr || !challenge) {
      return { success: false, error: 'Challenge not found in system.' }
    }

    if (challenge.name.trim() !== confirmedName.trim()) {
      return {
        success: false,
        error: `Confirmation title does not match. Expected "${challenge.name.trim()}".`,
      }
    }

    // 2. Try atomic RPC delete first
    const { error: rpcErr } = await supabase.rpc('delete_challenge', {
      target_challenge_id: challengeId,
      confirmed_name: confirmedName.trim(),
    })

    if (rpcErr) {
      console.warn('[deleteChallenge] RPC delete failed or not defined, trying direct cascade delete:', rpcErr.message)
      const { error: delErr } = await supabase
        .from('challenges')
        .delete()
        .eq('id', challengeId)

      if (delErr) {
        return { success: false, error: `Deletion failed: ${delErr.message}` }
      }
    }

    // 3. Clear selected challenge session cookie if it pointed to this challenge
    try {
      const cookieStore = await cookies()
      if (cookieStore.get(SELECTED_CHALLENGE_COOKIE)?.value === challengeId) {
        cookieStore.delete(SELECTED_CHALLENGE_COOKIE)
      }
    } catch {
      // Ignore cookie errors
    }

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')
    revalidatePath('/hub')
    revalidatePath('/challenges')

    return { success: true }
  } catch (err) {
    console.error('[deleteChallenge] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting challenge.',
    }
  }
}

/**
 * Export results CSV for a challenge before deletion or for administrative archival.
 */
export async function getChallengeExportCsv(challengeId: string): Promise<{
  success: boolean
  csv?: string
  filename?: string
  error?: string
}> {
  try {
    const { supabase } = await assertAdmin()

    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (!challenge) return { success: false, error: 'Challenge not found' }

    const [daysRes, membersRes, actCompsRes, compsRes] = await Promise.all([
      supabase
        .from('challenge_days')
        .select('id, day_number, title, scripture_reference, activities(id, description)')
        .eq('challenge_id', challengeId)
        .order('day_number', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'member')
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_completions')
        .select('id, user_id, activity_id, completed_at'),
      supabase
        .from('completions')
        .select('id, user_id, challenge_day_id, completed_at'),
    ])

    const days = daysRes.data ?? []
    const members = membersRes.data ?? []
    const actComps = actCompsRes.data ?? []
    const comps = compsRes.data ?? []

    const validDayIds = new Set(days.map((d) => d.id))
    const validActIds = new Set(
      days.flatMap((d) => (d.activities as { id: string }[] ?? []).map((a) => a.id))
    )

    const challengeActComps = actComps.filter((ac) => validActIds.has(ac.activity_id))
    const challengeComps = comps.filter((c) => validDayIds.has(c.challenge_day_id))

    function escapeCsv(val: unknown): string {
      if (val === null || val === undefined) return '""'
      return `"${String(val).replace(/"/g, '""')}"`
    }

    const headers = [
      'Member Name',
      'Email',
      'Fellowship Unit',
      'Challenge Name',
      'Total Activities Completed',
      'Total Full Days Completed',
      'Last Completed Date',
    ]

    const rows = members.map((m) => {
      const userActs = challengeActComps.filter((ac) => ac.user_id === m.id)
      const userDays = challengeComps.filter((c) => c.user_id === m.id)
      const lastAct = userActs.sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )[0]

      return [
        escapeCsv(m.full_name),
        escapeCsv(m.email),
        escapeCsv(m.fellowship_unit || 'General Assembly'),
        escapeCsv(challenge.name),
        userActs.length,
        userDays.length,
        escapeCsv(lastAct?.completed_at ? new Date(lastAct.completed_at).toISOString().split('T')[0] : 'N/A'),
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\r\n')
    const safeTitle = challenge.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const stamp = new Date().toISOString().split('T')[0]
    const filename = `bbcc_${safeTitle}_results_${stamp}.csv`

    return { success: true, csv: csvContent, filename }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to export challenge CSV',
    }
  }
}


/**
 * Update challenge start date and timezone (legacy / backwards compatibility).
 * Shifts universal day calculation for all members.
 */
export async function updateChallengeSettings(
  startDate: string | null,
  timezone = 'Africa/Lagos',
  durationDays = 40,
  challengeName = 'Overcomer'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()

    // Use update() (not upsert) — row id=1 is guaranteed to exist.
    const { error } = await supabase
      .from('challenge_settings')
      .update({
        start_date: startDate || null,
        timezone: timezone || 'Africa/Lagos',
        duration_days: Math.max(1, Math.min(365, durationDays)),
        challenge_name: challengeName.trim() || 'Overcomer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      console.error('[updateChallengeSettings] Supabase error:', error)
      return { success: false, error: `Failed to save settings: ${error.message}` }
    }

    revalidatePath('/admin', 'page')
    revalidatePath('/admin', 'layout')
    revalidatePath('/dashboard', 'page')
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/progress', 'page')
    revalidatePath('/leaderboard', 'page')
    revalidatePath('/community', 'page')

    return { success: true }
  } catch (err) {
    console.error('[updateChallengeSettings] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update challenge settings',
    }
  }
}

/**
 * Validate that a URL is a valid http:// or https:// web URL.
 * Rejects javascript:, data:, file:, relative, or malformed URLs.
 */
function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || !urlString.trim()) return true
  try {
    const url = new URL(urlString.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Save day content and its associated activities.
 */
export async function saveChallengeDay(params: {
  challengeId?: string
  dayNumber: number
  title: string
  description: string
  scriptureReference: string
  activities: { id?: string; description: string; sort_order: number; video_url?: string | null }[]
}): Promise<{
  success: boolean
  error?: string
  dayId?: string
  day?: {
    id: string
    challenge_id?: string
    day_number: number
    title: string
    description: string | null
    scripture_reference: string
    activities: { id: string; challenge_day_id: string; description: string; sort_order: number; video_url?: string | null }[]
  }
}> {
  try {
    const { supabase } = await assertAdmin()
    const { challengeId, dayNumber, title, description, scriptureReference, activities } = params

    if (!title || !title.trim()) {
      return { success: false, error: 'Challenge day title cannot be empty.' }
    }

    // Strictly validate all activity video URLs
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i]
      const vUrl = act.video_url?.trim()
      if (vUrl && !isValidHttpUrl(vUrl)) {
        return {
          success: false,
          error: `Invalid video URL "${vUrl}" on activity #${i + 1}: must be a valid web link starting with http:// or https://`,
        }
      }
    }

    // Resolve target challenge ID
    let targetChallengeId = challengeId
    if (!targetChallengeId) {
      const { data: c } = await supabase
        .from('challenges')
        .select('id')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      targetChallengeId = c?.id
    }

    // 1. Upsert challenge_day
    const upsertPayload: Record<string, unknown> = {
      day_number: dayNumber,
      title: title.trim(),
      description: description.trim() || null,
      scripture_reference: scriptureReference.trim(),
      updated_at: new Date().toISOString(),
    }
    if (targetChallengeId) {
      upsertPayload.challenge_id = targetChallengeId
    }

    const { data: dayRow, error: dayError } = await supabase
      .from('challenge_days')
      .upsert(
        upsertPayload as any,
        { onConflict: targetChallengeId ? 'challenge_id,day_number' : 'day_number' }
      )
      .select('id')
      .single()

    if (dayError || !dayRow) {
      console.error('[saveChallengeDay] Day upsert error:', dayError)
      return { success: false, error: dayError?.message || 'Failed to save challenge day' }
    }

    const dayId = dayRow.id

    // 2. Fetch existing activities for this day
    const { data: existingActivities, error: existingError } = await supabase
      .from('activities')
      .select('id')
      .eq('challenge_day_id', dayId)

    if (existingError) {
      console.error('[saveChallengeDay] Fetch existing activities error:', existingError)
      return { success: false, error: `Failed to check existing activities: ${existingError.message}` }
    }

    const existingIds = new Set((existingActivities ?? []).map((a) => a.id))
    const incomingIds = new Set(
      activities.filter((a) => a.id).map((a) => a.id as string)
    )

    // 3. Delete removed activities
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
    if (toDelete.length > 0) {
      const { error: delError } = await supabase.from('activities').delete().in('id', toDelete)
      if (delError) {
        console.error('[saveChallengeDay] Delete activities error:', delError)
        return { success: false, error: `Failed to delete removed activities: ${delError.message}` }
      }
    }

    // 4. Upsert/insert activities with strict error verification
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i]
      const videoUrlToSave = act.video_url?.trim() || null

      if (act.id && existingIds.has(act.id)) {
        const { error: updError } = await supabase
          .from('activities')
          .update({
            description: act.description.trim(),
            sort_order: i + 1,
            video_url: videoUrlToSave,
          })
          .eq('id', act.id)

        if (updError) {
          console.error('[saveChallengeDay] Update activity error:', updError)
          return { success: false, error: `Failed to update activity "${act.description}": ${updError.message}` }
        }
      } else {
        const { error: insError } = await supabase.from('activities').insert({
          challenge_day_id: dayId,
          description: act.description.trim(),
          sort_order: i + 1,
          video_url: videoUrlToSave,
        })

        if (insError) {
          console.error('[saveChallengeDay] Insert activity error:', insError)
          return { success: false, error: `Failed to save activity "${act.description}": ${insError.message}` }
        }
      }
    }

    // Fetch newly saved activities with their assigned IDs and video_url
    const { data: savedActivities, error: refetchError } = await supabase
      .from('activities')
      .select('id, challenge_day_id, description, sort_order, video_url')
      .eq('challenge_day_id', dayId)
      .order('sort_order', { ascending: true })

    if (refetchError) {
      console.error('[saveChallengeDay] Refetch activities error:', refetchError)
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard', 'page')
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/progress', 'page')

    return {
      success: true,
      dayId,
      day: {
        id: dayId,
        challenge_id: targetChallengeId,
        day_number: dayNumber,
        title: title.trim(),
        description: description.trim() || null,
        scripture_reference: scriptureReference.trim(),
        activities: (savedActivities ?? []).map((a) => ({
          id: a.id,
          challenge_day_id: a.challenge_day_id,
          description: a.description,
          sort_order: a.sort_order,
          video_url: a.video_url ?? '',
        })),
      },
    }
  } catch (err) {
    console.error('[saveChallengeDay] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save challenge day',
    }
  }
}

/**
 * Fetch a single challenge day and its activities directly from the database.
 * Used by CurriculumArchitect when switching days to guarantee fresh data.
 */
export async function getChallengeDay(dayNumber: number, challengeId?: string) {
  try {
    const { supabase } = await assertAdmin()

    let query = supabase
      .from('challenge_days')
      .select('id, challenge_id, day_number, title, description, scripture_reference, activities(id, challenge_day_id, description, sort_order, video_url)')
      .eq('day_number', dayNumber)

    if (challengeId) {
      query = query.eq('challenge_id', challengeId)
    }

    const { data: dayRow, error } = await query.maybeSingle()

    if (error) {
      console.error('[getChallengeDay] Database error:', error)
      return null
    }

    if (!dayRow) return null

    return {
      ...dayRow,
      activities: ((dayRow.activities as { id: string; challenge_day_id: string; description: string; sort_order: number; video_url?: string | null }[]) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }
  } catch (err) {
    console.error('[getChallengeDay] Error:', err)
    return null
  }
}

/**
 * Initialize / quick-populate all challenge days with default templates
 * if they don't already exist, up to duration_days from settings.
 */
export async function seedChallengeDays(): Promise<{
  success: boolean
  error?: string
  count?: number
}> {
  try {
    const { supabase } = await assertAdmin()

    const { data: settings } = await supabase
      .from('challenge_settings')
      .select('duration_days, challenge_name')
      .eq('id', 1)
      .single()

    const dur = settings?.duration_days ?? 40
    const cname = settings?.challenge_name ?? 'Overcomer'

    for (let i = 1; i <= dur; i++) {
      const { data: dayRow, error: dayError } = await supabase
        .from('challenge_days')
        .upsert(
          {
            day_number: i,
            title: `Day ${i}: Consecration & Spiritual Discipline`,
            description: `Daily devotional focus and prayer alignment for Day ${i} of the ${dur} Days of ${cname} Challenge.`,
            scripture_reference: 'Galatians 5:16-25 & Romans 8:1-14',
          },
          { onConflict: 'day_number' }
        )
        .select('id')
        .single()

      if (dayError) {
        console.error(`[seedChallengeDays] Error on day ${i}:`, dayError)
        return { success: false, error: `Failed initializing Day ${i}: ${dayError.message}` }
      }

      if (dayRow) {
        const { data: existingActs } = await supabase
          .from('activities')
          .select('id')
          .eq('challenge_day_id', dayRow.id)

        if (!existingActs || existingActs.length === 0) {
          const { error: actError } = await supabase.from('activities').insert([
            {
              challenge_day_id: dayRow.id,
              description: 'Morning Prayer Watch (30 mins personal devotion)',
              sort_order: 1,
            },
            {
              challenge_day_id: dayRow.id,
              description: 'Scripture Meditation & Journaling',
              sort_order: 2,
            },
            {
              challenge_day_id: dayRow.id,
              description: 'Midday Fasting & Fellowship Consecration',
              sort_order: 3,
            },
          ])

          if (actError) {
            console.error(`[seedChallengeDays] Error inserting activities for day ${i}:`, actError)
          }
        }
      }
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true, count: dur }
  } catch (err) {
    console.error('[seedChallengeDays] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to seed challenge days',
    }
  }
}

export const seed40Days = seedChallengeDays

/**
 * Approve a pending or rejected church member.
 * Grants immediate access to dashboard, curriculum, completions, and community.
 */
export async function approveMember(
  memberId: string
): Promise<{ success: boolean; error?: string; memberId?: string }> {
  try {
    const { supabase } = await assertAdmin()

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', memberId)

    if (error) {
      console.error('[approveMember] Error approving member:', error)
      return { success: false, error: `Failed to approve member: ${error.message}` }
    }

    revalidatePath('/admin')
    revalidatePath('/admin', 'page')
    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    revalidatePath('/community')
    return { success: true, memberId }
  } catch (err) {
    console.error('[approveMember] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve member',
    }
  }
}

/**
 * Reject a member registration request.
 * Sets status = 'rejected' and directs them to the pastoral contact holding notice.
 */
export async function rejectMember(
  memberId: string
): Promise<{ success: boolean; error?: string; memberId?: string }> {
  try {
    const { supabase } = await assertAdmin()

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected' })
      .eq('id', memberId)

    if (error) {
      console.error('[rejectMember] Error rejecting member:', error)
      return { success: false, error: `Failed to reject member: ${error.message}` }
    }

    revalidatePath('/admin')
    revalidatePath('/admin', 'page')
    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    revalidatePath('/community')
    return { success: true, memberId }
  } catch (err) {
    console.error('[rejectMember] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reject member',
    }
  }
}

/**
 * Assign, edit, or clear a member's cosmetic display tag (e.g. "Pastor", "Choir Lead").
 * This is strictly a cosmetic display label and does NOT grant or alter administrative permissions or RLS.
 */
export async function updateMemberDisplayTag(
  memberId: string,
  displayTag: string | null
): Promise<{ success: boolean; error?: string; memberId?: string; displayTag?: string | null }> {
  try {
    const { supabase } = await assertAdmin()

    const cleanTag = displayTag && displayTag.trim().length > 0 ? displayTag.trim() : null

    const { error } = await supabase
      .from('profiles')
      .update({ display_tag: cleanTag })
      .eq('id', memberId)

    if (error) {
      console.error('[updateMemberDisplayTag] Error updating member display tag:', error)
      return { success: false, error: `Failed to update display tag: ${error.message}` }
    }

    revalidatePath('/admin')
    revalidatePath('/admin', 'page')
    revalidatePath('/admin', 'layout')
    revalidatePath('/dashboard', 'page')
    revalidatePath('/leaderboard', 'page')
    revalidatePath('/community', 'page')

    return { success: true, memberId, displayTag: cleanTag }
  } catch (err) {
    console.error('[updateMemberDisplayTag] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update display tag',
    }
  }
}
