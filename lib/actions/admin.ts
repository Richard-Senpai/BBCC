'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  Profile,
  Challenge,
  ChallengeStatus,
  ChallengeWithStats,
  ChallengeDayWithActivities,
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

        return {
          ...c,
          status,
          current_day: currentDay,
          end_date: endStr,
          participant_count: participantCount,
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
export async function updateChallenge(
  challengeId: string,
  params: {
    name: string
    durationDays: number
    startDate: string
    timezone?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await assertAdmin()
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

    const { error: updErr } = await supabase
      .from('challenges')
      .update({
        name,
        duration_days: durationDays,
        start_date: startDate,
        timezone,
      })
      .eq('id', challengeId)

    if (updErr) {
      return { success: false, error: updErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/analytics')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')

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
