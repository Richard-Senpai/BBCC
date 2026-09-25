'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Toggle an individual activity's completion state for today.
 *
 * After toggling, checks whether ALL activities for the given
 * challenge day are now complete.  If so, upserts a row into
 * `completions` (day-level).  If not all done (or unchecked),
 * removes any existing day-level completion so the streak stays
 * accurate.
 */
export async function toggleActivityCompletion(
  activityId: string,
  challengeDayId: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // ── 1. Toggle the individual activity completion ───────────
  const { data: existing } = await supabase
    .from('activity_completions')
    .select('id')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('activity_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
  } else {
    await supabase
      .from('activity_completions')
      .insert({ user_id: user.id, activity_id: activityId })
  }

  // ── 2. Check if all activities for this day are now done ───
  const { data: allActivities } = await supabase
    .from('activities')
    .select('id')
    .eq('challenge_day_id', challengeDayId)

  const activityIds = (allActivities ?? []).map((a) => a.id)

  const { data: doneActivities } = await supabase
    .from('activity_completions')
    .select('activity_id')
    .eq('user_id', user.id)
    .in('activity_id', activityIds)

  const allDone =
    activityIds.length > 0 &&
    (doneActivities?.length ?? 0) === activityIds.length

  // ── 3. Update day-level completion accordingly ─────────────
  if (allDone) {
    await supabase.from('completions').upsert(
      { user_id: user.id, challenge_day_id: challengeDayId },
      { onConflict: 'user_id,challenge_day_id' }
    )
  } else {
    await supabase
      .from('completions')
      .delete()
      .eq('user_id', user.id)
      .eq('challenge_day_id', challengeDayId)
  }

  revalidatePath('/dashboard')
}
