'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { JournalEntry, JournalEntryWithDay } from '@/lib/types'

export type SaveJournalResponse =
  | { success: true; entry: JournalEntry; error?: never }
  | { success: false; error: string; entry?: never }

export type GetJournalResponse =
  | { success: true; entry: JournalEntry | null; error?: never }
  | { success: false; error: string; entry: null }

export type GetUserJournalsResponse =
  | { success: true; entries: JournalEntryWithDay[]; error?: never }
  | { success: false; error: string; entries: JournalEntryWithDay[] }

/**
 * Save or update a member's daily spiritual reflections and journal note.
 * Uses UPSERT with (user_id, challenge_day_id) UNIQUE constraint.
 * Private to the user (enforced both in Server Action and RLS).
 */
export async function saveJournalEntry(
  challengeDayId: string,
  content: string
): Promise<SaveJournalResponse> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'You must be signed in to save journal notes.' }
    }

    if (!challengeDayId) {
      return { success: false, error: 'Missing challenge day reference.' }
    }

    // ── Guardrail: ensure challenge is active ───────────────────
    const { data: dayRow } = await supabase
      .from('challenge_days')
      .select('id, challenge_id')
      .eq('id', challengeDayId)
      .single()

    if (!dayRow) {
      return { success: false, error: 'Challenge day not found.' }
    }

    if (dayRow.challenge_id) {
      const { data: statusRes } = await supabase.rpc('get_challenge_status', { c_id: dayRow.challenge_id })
      if (statusRes !== 'active') {
        return {
          success: false,
          error: 'This challenge has concluded. Journal entries are preserved as read-only reflections.',
        }
      }
    }

    const cleanContent = typeof content === 'string' ? content.trim() : ''
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: user.id,
          challenge_day_id: challengeDayId,
          content: cleanContent,
          updated_at: now,
        },
        { onConflict: 'user_id,challenge_day_id' }
      )
      .select('id, user_id, challenge_day_id, content, created_at, updated_at')
      .single()

    if (error) {
      console.error('[saveJournalEntry] Database error:', error)
      return { success: false, error: `Failed to save journal note: ${error.message}` }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/dashboard/profile')

    return { success: true, entry: data as JournalEntry }
  } catch (err) {
    console.error('[saveJournalEntry] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred while saving note.',
    }
  }
}

/**
 * Fetch a member's journal note for a specific challenge day.
 */
export async function getJournalEntry(
  challengeDayId: string
): Promise<GetJournalResponse> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized', entry: null }
    }

    if (!challengeDayId) {
      return { success: false, error: 'Missing day ID', entry: null }
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, user_id, challenge_day_id, content, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('challenge_day_id', challengeDayId)
      .maybeSingle()

    if (error) {
      console.error('[getJournalEntry] Database error:', error)
      return { success: false, error: error.message, entry: null }
    }

    return { success: true, entry: (data as JournalEntry) || null }
  } catch (err) {
    console.error('[getJournalEntry] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve journal note.',
      entry: null,
    }
  }
}

/**
 * Fetch all journal reflections for the current authenticated member.
 * Only returns days where a note was actually written.
 * Can be optionally scoped to a target challenge.
 */
export async function getUserJournalEntries(
  targetChallengeId?: string
): Promise<GetUserJournalsResponse> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized', entries: [] }
    }

    let query = supabase
      .from('journal_entries')
      .select(
        'id, user_id, challenge_day_id, content, created_at, updated_at, challenge_days!inner(id, day_number, title, scripture_reference, challenge_id)'
      )
      .eq('user_id', user.id)
      .neq('content', '')

    if (targetChallengeId) {
      query = query.eq('challenge_days.challenge_id', targetChallengeId)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      console.error('[getUserJournalEntries] Database error:', error)
      return { success: false, error: error.message, entries: [] }
    }

    return { success: true, entries: (data as unknown as JournalEntryWithDay[]) || [] }
  } catch (err) {
    console.error('[getUserJournalEntries] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch personal journal entries.',
      entries: [],
    }
  }
}
