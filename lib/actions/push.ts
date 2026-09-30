'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUsers, checkAndDispatchNewDayPush } from '@/lib/push-server'

export interface SaveSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Save or refresh a browser push subscription for the logged-in member.
 */
export async function savePushSubscription(
  input: SaveSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated' }
    }

    if (!input.endpoint || !input.p256dh || !input.auth) {
      return { success: false, error: 'Invalid push subscription payload' }
    }

    // Upsert subscription by endpoint
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        { onConflict: 'endpoint' }
      )

    if (insertError) {
      console.error('[savePushSubscription] Upsert error:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[savePushSubscription] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save push subscription.',
    }
  }
}

/**
 * Remove a specific device subscription when member disables push.
 */
export async function removePushSubscription(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)

    if (error) {
      console.error('[removePushSubscription] Delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[removePushSubscription] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove push subscription.',
    }
  }
}

/**
 * Update per-category notification preferences on the member's profile.
 */
export async function updateNotificationPreferences(prefs: {
  new_day_enabled?: boolean
  announcements_enabled?: boolean
  chat_enabled?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const updates: {
      new_day_enabled?: boolean
      announcements_enabled?: boolean
      chat_enabled?: boolean
    } = {}
    if (typeof prefs.new_day_enabled === 'boolean') updates.new_day_enabled = prefs.new_day_enabled
    if (typeof prefs.announcements_enabled === 'boolean') updates.announcements_enabled = prefs.announcements_enabled
    if (typeof prefs.chat_enabled === 'boolean') updates.chat_enabled = prefs.chat_enabled

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      console.error('[updateNotificationPreferences] Update error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (err) {
    console.error('[updateNotificationPreferences] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update preferences.',
    }
  }
}

/**
 * Send an immediate test notification to the calling member's devices.
 */
export async function sendTestPushToSelf(): Promise<{
  success: boolean
  error?: string
  sent?: number
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const result = await sendPushToUsers([user.id], 'announcements', {
      title: 'BBCC Consecration Push Active',
      body: 'Your device is successfully configured to receive fellowship updates and daily disciplines.',
      url: '/dashboard/profile',
      tag: 'test-push',
    })

    return { success: result.success, sent: result.sent }
  } catch (err) {
    console.error('[sendTestPushToSelf] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test push.',
    }
  }
}

/**
 * Admin manual trigger to check and dispatch the daily new day push.
 */
export async function triggerNewDayPushCheck(force = false): Promise<{
  success: boolean
  skipped?: boolean
  reason?: string
  currentDay?: number
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, reason: 'Unauthenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, reason: 'Only administrators can manually trigger day push check.' }
    }

    const res = await checkAndDispatchNewDayPush({ force })
    return res
  } catch (err) {
    console.error('[triggerNewDayPushCheck] Unexpected error:', err)
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'Failed to trigger check.',
    }
  }
}
