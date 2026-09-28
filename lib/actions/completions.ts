'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Toggle an individual activity's completion state for today.
 *
 * After toggling, checks whether ALL activities for the given
 * challenge day are now complete. If so, upserts a row into
 * `completions` (day-level). If not all done (or unchecked),
 * removes any existing day-level completion so the streak stays
 * accurate.
 */
export async function toggleActivityCompletion(
  activityId: string,
  challengeDayId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated: please sign in.' }
    }

    if (!activityId || !challengeDayId) {
      return { success: false, error: 'Invalid activity or challenge day identifier.' }
    }

    // ── 1. Toggle the individual activity completion ───────────
    const { data: existing, error: existingError } = await supabase
      .from('activity_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .maybeSingle()

    if (existingError) {
      console.error('[toggleActivityCompletion] Check existing error:', existingError)
      return { success: false, error: `Failed to check completion state: ${existingError.message}` }
    }

    if (existing) {
      const { error: delError } = await supabase
        .from('activity_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('activity_id', activityId)

      if (delError) {
        console.error('[toggleActivityCompletion] Delete error:', delError)
        return { success: false, error: `Failed to uncheck activity: ${delError.message}` }
      }
    } else {
      const { error: insError } = await supabase
        .from('activity_completions')
        .insert({ user_id: user.id, activity_id: activityId })

      if (insError) {
        console.error('[toggleActivityCompletion] Insert error:', insError)
        return { success: false, error: `Failed to record activity: ${insError.message}` }
      }
    }

    // ── 2. Check if all activities for this day are now done ───
    const { data: allActivities, error: allActsError } = await supabase
      .from('activities')
      .select('id')
      .eq('challenge_day_id', challengeDayId)

    if (allActsError) {
      console.error('[toggleActivityCompletion] Fetch all activities error:', allActsError)
    }

    const activityIds = (allActivities ?? []).map((a) => a.id)

    const { data: doneActivities, error: doneActsError } = await supabase
      .from('activity_completions')
      .select('activity_id')
      .eq('user_id', user.id)
      .in('activity_id', activityIds)

    if (doneActsError) {
      console.error('[toggleActivityCompletion] Fetch done activities error:', doneActsError)
    }

    const allDone =
      activityIds.length > 0 &&
      (doneActivities?.length ?? 0) === activityIds.length

    // ── 3. Update day-level completion accordingly ─────────────
    if (allDone) {
      const { error: compError } = await supabase.from('completions').upsert(
        { user_id: user.id, challenge_day_id: challengeDayId },
        { onConflict: 'user_id,challenge_day_id' }
      )
      if (compError) {
        console.error('[toggleActivityCompletion] Day upsert error:', compError)
      }
    } else {
      const { error: compDelError } = await supabase
        .from('completions')
        .delete()
        .eq('user_id', user.id)
        .eq('challenge_day_id', challengeDayId)
      if (compDelError) {
        console.error('[toggleActivityCompletion] Day delete error:', compDelError)
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')

    return { success: true }
  } catch (err) {
    console.error('[toggleActivityCompletion] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update discipline status.',
    }
  }
}
