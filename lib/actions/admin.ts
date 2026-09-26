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
  timezone = 'Africa/Lagos',
  durationDays = 40,
  challengeName = 'Overcomer'
) {
  const { supabase } = await assertAdmin()

  // Use update() (not upsert) — row id=1 is always guaranteed to exist.
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

  if (error) throw new Error(`Failed to save settings: ${error.message}`)

  revalidatePath('/admin', 'page')
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard', 'page')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/progress', 'page')
  revalidatePath('/leaderboard', 'page')
  revalidatePath('/community', 'page')
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
  const { data: existingActivities, error: existingError } = await supabase
    .from('activities')
    .select('id')
    .eq('challenge_day_id', dayId)

  if (existingError) {
    console.error('Error fetching existing activities:', existingError)
    throw new Error(`Failed to check existing activities: ${existingError.message}`)
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
      console.error('Error deleting removed activities:', delError)
      throw new Error(`Failed to delete removed activities: ${delError.message}`)
    }
  }

  // 4. Upsert/insert activities with strict error verification
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i]
    if (act.id && existingIds.has(act.id)) {
      const { error: updError } = await supabase
        .from('activities')
        .update({
          description: act.description.trim(),
          sort_order: i + 1,
        })
        .eq('id', act.id)

      if (updError) {
        console.error('Error updating activity:', updError)
        throw new Error(`Failed to update activity "${act.description}": ${updError.message}`)
      }
    } else {
      const { error: insError } = await supabase.from('activities').insert({
        challenge_day_id: dayId,
        description: act.description.trim(),
        sort_order: i + 1,
      })

      if (insError) {
        console.error('Error inserting activity:', insError)
        throw new Error(`Failed to save activity "${act.description}": ${insError.message}`)
      }
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard', 'page')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/progress', 'page')
  return { success: true, dayId }
}

/**
 * Initialize / quick-populate all challenge days with default templates
 * if they don't already exist, up to duration_days from settings.
 */
export async function seedChallengeDays() {
  const { supabase } = await assertAdmin()

  const { data: settings } = await supabase
    .from('challenge_settings')
    .select('duration_days, challenge_name')
    .eq('id', 1)
    .single()

  const dur = settings?.duration_days ?? 40
  const cname = settings?.challenge_name ?? 'Overcomer'

  for (let i = 1; i <= dur; i++) {
    const { data: dayRow } = await supabase
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
  return { success: true, count: dur }
}

export const seed40Days = seedChallengeDays
