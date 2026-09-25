'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (profile?.role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  return { supabase, user }
}

/**
 * Update challenge start date and timezone.
 * Shifts universal day calculation for all members.
 */
export async function updateChallengeSettings(
  startDate: string | null,
  timezone = 'Africa/Lagos'
) {
  const { supabase } = await assertAdmin()

  const { error } = await supabase
    .from('challenge_settings')
    .upsert({
      id: 1,
      start_date: startDate || null,
      timezone: timezone || 'Africa/Lagos',
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/progress')
  revalidatePath('/leaderboard')
  return { success: true }
}

/**
 * Save day content and its associated activities.
 */
export async function saveChallengeDay(params: {
  dayNumber: number
  title: string
  description: string
  scriptureReference: string
  activities: { id?: string; description: string; sort_order: number }[]
}) {
  const { supabase } = await assertAdmin()
  const { dayNumber, title, description, scriptureReference, activities } = params

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
    throw new Error(dayError?.message || 'Failed to save challenge day')
  }

  const dayId = dayRow.id

  // 2. Fetch existing activities for this day
  const { data: existingActivities } = await supabase
    .from('activities')
    .select('id')
    .eq('challenge_day_id', dayId)

  const existingIds = new Set((existingActivities ?? []).map((a) => a.id))
  const incomingIds = new Set(
    activities.filter((a) => a.id).map((a) => a.id as string)
  )

  // 3. Delete removed activities
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
  if (toDelete.length > 0) {
    await supabase.from('activities').delete().in('id', toDelete)
  }

  // 4. Upsert/insert activities
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i]
    if (act.id && existingIds.has(act.id)) {
      await supabase
        .from('activities')
        .update({
          description: act.description.trim(),
          sort_order: i + 1,
        })
        .eq('id', act.id)
    } else {
      await supabase.from('activities').insert({
        challenge_day_id: dayId,
        description: act.description.trim(),
        sort_order: i + 1,
      })
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true, dayId }
}

/**
 * Initialize / quick-populate all 40 challenge days with default templates
 * if they don't already exist.
 */
export async function seed40Days() {
  const { supabase } = await assertAdmin()

  for (let i = 1; i <= 40; i++) {
    const { data: dayRow } = await supabase
      .from('challenge_days')
      .upsert(
        {
          day_number: i,
          title: `Day ${i}: Consecration & Spiritual Discipline`,
          description: `Daily devotional focus and prayer alignment for Day ${i} of the 40-Day Challenge.`,
          scripture_reference: 'Galatians 5:16-25 & Romans 8:1-14',
        },
        { onConflict: 'day_number' }
      )
      .select('id')
      .single()

    if (dayRow) {
      const { data: existingActs } = await supabase
        .from('activities')
        .select('id')
        .eq('challenge_day_id', dayRow.id)

      if (!existingActs || existingActs.length === 0) {
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
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}
