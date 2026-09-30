import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import type { PushCategory, PushPayload, PushDispatchResult } from '@/lib/types'

let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:pastoral@bbccileife.org'

  if (!publicKey || !privateKey) {
    console.warn('[push-server] VAPID keys not configured in environment.')
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch (err) {
    console.error('[push-server] Failed to set VAPID details:', err)
    return false
  }
}

/**
 * Reusable server-side function that sends a web push notification to a list of user_ids,
 * respecting each user's relevant category toggle, and removes push_subscriptions
 * rows if delivery returns 404/410 (expired/invalid).
 */
export async function sendPushToUsers(
  userIds: string[],
  category: PushCategory,
  payload: PushPayload
): Promise<PushDispatchResult> {
  if (!userIds || userIds.length === 0) {
    return { success: true, eligibleUsers: 0, sent: 0, failed: 0, cleaned: 0 }
  }

  const isConfigured = ensureVapidConfigured()
  if (!isConfigured) {
    return {
      success: false,
      error: 'VAPID keys not configured',
      eligibleUsers: 0,
      sent: 0,
      failed: 0,
      cleaned: 0,
    }
  }

  const supabase = await createClient()

  // 1. Identify category toggle column
  let categoryColumn: 'new_day_enabled' | 'announcements_enabled' | 'chat_enabled' = 'announcements_enabled'
  if (category === 'new_day') categoryColumn = 'new_day_enabled'
  if (category === 'announcements') categoryColumn = 'announcements_enabled'
  if (category === 'chat') categoryColumn = 'chat_enabled'

  // 2. Query eligible approved members who have this category enabled
  const { data: eligibleProfiles, error: profError } = await supabase
    .from('profiles')
    .select(`id, status, ${categoryColumn}`)
    .in('id', userIds)
    .eq('status', 'approved')
    .eq(categoryColumn, true)

  if (profError) {
    console.error('[sendPushToUsers] Error querying eligible profiles:', profError)
    return { success: false, error: profError.message, eligibleUsers: 0, sent: 0, failed: 0, cleaned: 0 }
  }

  if (!eligibleProfiles || eligibleProfiles.length === 0) {
    return { success: true, eligibleUsers: 0, sent: 0, failed: 0, cleaned: 0 }
  }

  const eligibleUserIds = eligibleProfiles.map((p) => p.id)

  // 3. Query all push subscriptions belonging to the eligible users
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', eligibleUserIds)

  if (subError) {
    console.error('[sendPushToUsers] Error querying push subscriptions:', subError)
    return { success: false, error: subError.message, eligibleUsers: eligibleUserIds.length, sent: 0, failed: 0, cleaned: 0 }
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, eligibleUsers: eligibleUserIds.length, sent: 0, failed: 0, cleaned: 0 }
  }

  // 4. Construct payload JSON
  const pushPayloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag || `bbcc-${category}`,
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    category,
    data: {
      url: payload.url || '/dashboard',
      category,
    },
  })

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  // 5. Send push notifications to all subscriptions concurrently
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayloadString
        )
        sent++
      } catch (err: unknown) {
        failed++
        const webPushErr = err as { statusCode?: number; message?: string }
        // 404 Not Found or 410 Gone indicates expired or revoked browser subscription
        if (webPushErr.statusCode === 404 || webPushErr.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint)
        } else {
          console.warn('[sendPushToUsers] Push send error for endpoint:', sub.endpoint, webPushErr.message || err)
        }
      }
    })
  )

  // 6. Clean up expired subscriptions from the database
  let cleaned = 0
  if (expiredEndpoints.length > 0) {
    cleaned = expiredEndpoints.length
    try {
      const { error: delError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)

      if (delError) {
        // Fallback: use RPC if RLS blocks service delete
        for (const ep of expiredEndpoints) {
          await supabase.rpc('delete_expired_push_subscription', { target_endpoint: ep })
        }
      }
    } catch (cleanErr) {
      console.error('[sendPushToUsers] Error cleaning expired subscriptions:', cleanErr)
    }
  }

  return {
    success: true,
    eligibleUsers: eligibleUserIds.length,
    sent,
    failed,
    cleaned,
  }
}

/**
 * Idempotently check if current challenge day has changed,
 * and dispatch new day push notifications to all approved members with new_day_enabled.
 */
export async function checkAndDispatchNewDayPush(options?: { force?: boolean }): Promise<{
  success: boolean
  skipped?: boolean
  reason?: string
  currentDay?: number
  dispatchResult?: PushDispatchResult
}> {
  try {
    const supabase = await createClient()

    // 1. Fetch current settings and day
    const [settingsRes, currentDayRes] = await Promise.all([
      supabase.from('challenge_settings').select('*').eq('id', 1).single(),
      supabase.rpc('get_current_challenge_day'),
    ])

    const settings = settingsRes.data
    const currentDay = (currentDayRes.data as number) ?? 0

    if (!settings) {
      return { success: false, reason: 'Challenge settings row not found' }
    }

    if (currentDay <= 0) {
      return { success: true, skipped: true, reason: 'Challenge has not started yet (Day 0)' }
    }

    const durationDays = settings.duration_days ?? 40
    if (currentDay > durationDays) {
      return { success: true, skipped: true, reason: `Challenge complete (Day ${currentDay} > ${durationDays})` }
    }

    const lastNotified = settings.last_notified_challenge_day ?? 0

    // Idempotency: skip if already notified for this day unless force=true
    if (!options?.force && currentDay <= lastNotified) {
      return {
        success: true,
        skipped: true,
        reason: `Day ${currentDay} was already notified (last_notified_challenge_day: ${lastNotified})`,
        currentDay,
      }
    }

    // 2. Fetch Day metadata (title, scripture reference)
    const { data: dayData } = await supabase
      .from('challenge_days')
      .select('title, scripture_reference')
      .eq('day_number', currentDay)
      .maybeSingle()

    const challengeName = settings.challenge_name || 'Overcomer'
    const dayTitle = dayData?.title ? `: ${dayData.title}` : ''
    const scripture = dayData?.scripture_reference ? ` (${dayData.scripture_reference})` : ''

    const notificationTitle = `Day ${currentDay} is Live! | ${challengeName}`
    const notificationBody = `Today's consecration disciplines are ready${dayTitle}${scripture}. Tap to open today's devotions.`

    // 3. Atomically update last_notified_challenge_day to currentDay
    const { error: updateError } = await supabase
      .from('challenge_settings')
      .update({ last_notified_challenge_day: currentDay })
      .eq('id', 1)

    if (updateError) {
      console.error('[checkAndDispatchNewDayPush] Error updating last_notified_challenge_day:', updateError)
    }

    // 4. Query all approved members
    const { data: approvedMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'approved')

    const memberIds = approvedMembers ? approvedMembers.map((m) => m.id) : []

    // 5. Dispatch push
    const dispatchResult = await sendPushToUsers(memberIds, 'new_day', {
      title: notificationTitle,
      body: notificationBody,
      url: '/dashboard',
      tag: `new-day-${currentDay}`,
    })

    return {
      success: true,
      currentDay,
      dispatchResult,
    }
  } catch (err) {
    console.error('[checkAndDispatchNewDayPush] Unexpected error:', err)
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'Unknown error during day dispatch',
    }
  }
}
