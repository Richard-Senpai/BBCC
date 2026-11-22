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
      .order('start_date', { ascending: false })

    if (error || !challenges) {
      console.error('[getAdminChallenges] Error:', error)
      return []
    }

    const results: ChallengeWithStats[] = await Promise.all(
      challenges.map(async (c) => {
        const startDate = c.start_date
        const duration = c.duration_days
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

        let pendingRequestsCount = 0
        if (c.enrollment_mode === 'approval') {
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

        return {
          ...c,
          enrollment_mode: (c.enrollment_mode as EnrollmentMode) || 'open',
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
 * Create a new challenge.
 * Validates that date ranges do not overlap an existing challenge.
 * Automatically generates day slots 1 to N with default templates and activities.
 */
export async function createChallenge(params: {
  name: string
  durationDays: number
  startDate: string
  timezone?: string
  enrollmentMode?: EnrollmentMode
}): Promise<{
  success: boolean
  error?: string
  challengeId?: string
}> {
  try {
    const { supabase } = await assertAdmin()
    const name = params.name.trim()
    const durationDays = Number(params.durationDays)
    const startDate = params.startDate.trim()
    const timezone = params.timezone?.trim() || 'Africa/Lagos'
    const enrollmentMode: EnrollmentMode = params.enrollmentMode === 'approval' ? 'approval' : 'open'

    if (!name) return { success: false, error: 'Challenge name cannot be empty.' }
    if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
      return { success: false, error: 'Duration must be between 1 and 365 days.' }
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      return { success: false, error: 'Please specify a valid start date.' }
    }

    // 1. Check overlap with all existing challenges
    const { data: existingChallenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('id, name, duration_days, start_date')

    if (fetchErr) {
      console.error('[createChallenge] Error fetching existing challenges:', fetchErr)
    }

    if (existingChallenges && existingChallenges.length > 0) {
      for (const ec of existingChallenges) {
        if (checkDateOverlap(startDate, durationDays, ec.start_date, ec.duration_days)) {
          const ecEndDate = new Date(
            new Date(ec.start_date + 'T00:00:00Z').getTime() + (ec.duration_days - 1) * 86400000
          )
            .toISOString()
            .split('T')[0]
          return {
            success: false,
            error: `Challenge dates overlap with existing challenge "${ec.name}" (${ec.start_date} to ${ecEndDate}). Challenges cannot overlap in dates.`,
          }
        }
      }
    }

    // 2. Insert new challenge
    const { data: newChallenge, error: insertErr } = await supabase
      .from('challenges')
      .insert({
        name,
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
      const { data: dayRow, error: dayError } = await supabase
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

      if (dayError) {
        console.error(`[createChallenge] Error generating day ${i}:`, dayError)
      } else if (dayRow) {
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
      if (sDay.day_number > targetChallenge.duration_days) continue

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
    durationDays: number
    startDate: string
    timezone?: string
    enrollmentMode?: EnrollmentMode
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertAdmin()
    const name = params.name.trim()
    const durationDays = Number(params.durationDays)
    const startDate = params.startDate.trim()
    const timezone = params.timezone?.trim() || 'Africa/Lagos'

    if (!name) return { success: false, error: 'Challenge name cannot be empty.' }
    if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
      return { success: false, error: 'Duration must be between 1 and 365 days.' }
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      return { success: false, error: 'Please specify a valid start date.' }
    }

    // Fetch existing challenge
    const { data: existingChallenge } = await supabase
      .from('challenges')
      .select('id, name, duration_days, start_date, enrollment_mode')
      .eq('id', challengeId)
      .single()

    // Check overlap with other challenges
    const { data: otherChallenges } = await supabase
      .from('challenges')
      .select('id, name, duration_days, start_date')
      .neq('id', challengeId)

    if (otherChallenges && otherChallenges.length > 0) {
      for (const oc of otherChallenges) {
        if (checkDateOverlap(startDate, durationDays, oc.start_date, oc.duration_days)) {
          const ocEndDate = new Date(
            new Date(oc.start_date + 'T00:00:00Z').getTime() + (oc.duration_days - 1) * 86400000
          )
            .toISOString()
            .split('T')[0]
          return {
            success: false,
            error: `Challenge dates overlap with existing challenge "${oc.name}" (${oc.start_date} to ${ocEndDate}). Challenges cannot overlap in dates.`,
          }
        }
      }
    }

    const currentMode = existingChallenge?.enrollment_mode || 'open'
    const targetMode = params.enrollmentMode || currentMode

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

    const { count: enrollCount } = await supabase
      .from('challenge_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    const tz = challenge.timezone || 'Africa/Lagos'
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    const endStr = new Date(
      new Date(challenge.start_date + 'T00:00:00Z').getTime() + (challenge.duration_days - 1) * 86400000
    )
      .toISOString()
      .split('T')[0]

    const status: ChallengeStatus =
      todayStr < challenge.start_date ? 'upcoming' : todayStr > endStr ? 'completed' : 'active'

    const summary: ChallengeDeleteSummary = {
      id: challenge.id,
      name: challenge.name,
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
