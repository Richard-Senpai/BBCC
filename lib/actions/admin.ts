'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

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
 * Update challenge start date and timezone.
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
    day_number: number
    title: string
    description: string | null
    scripture_reference: string
    activities: { id: string; challenge_day_id: string; description: string; sort_order: number; video_url?: string | null }[]
  }
}> {
  try {
    const { supabase } = await assertAdmin()
    const { dayNumber, title, description, scriptureReference, activities } = params

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

    // 1. Upsert challenge_day
    const { data: dayRow, error: dayError } = await supabase
      .from('challenge_days')
      .upsert(
        {
          day_number: dayNumber,
          title: title.trim(),
          description: description.trim() || null,
          scripture_reference: scriptureReference.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'day_number' }
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
export async function getChallengeDay(dayNumber: number) {
  try {
    const { supabase } = await assertAdmin()

    const { data: dayRow, error } = await supabase
      .from('challenge_days')
      .select('id, day_number, title, description, scripture_reference, activities(id, challenge_day_id, description, sort_order, video_url)')
      .eq('day_number', dayNumber)
      .maybeSingle()

    if (error) {
      console.error('[getChallengeDay] Database error:', error)
      return null
    }

    if (!dayRow) return null

    return {
      ...dayRow,
      activities: (dayRow.activities ?? []).sort((a, b) => a.sort_order - b.sort_order),
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
