'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  BellRing,
  BellOff,
  Smartphone,
  Share,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
} from 'lucide-react'
import {
  isPushSupported,
  isIosDevice,
  isStandalonePwa,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  registerServiceWorker,
} from '@/lib/push-client'
import {
  savePushSubscription,
  removePushSubscription,
  updateNotificationPreferences,
  sendTestPushToSelf,
} from '@/lib/actions/push'

interface NotificationSettingsSectionProps {
  userId: string
  initialPrefs: {
    new_day_enabled: boolean
    announcements_enabled: boolean
    chat_enabled: boolean
  }
}

export default function NotificationSettingsSection({
  initialPrefs,
}: NotificationSettingsSectionProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isPwa, setIsPwa] = useState(false)

  const [prefs, setPrefs] = useState({
    new_day_enabled: initialPrefs?.new_day_enabled ?? true,
    announcements_enabled: initialPrefs?.announcements_enabled ?? true,
    chat_enabled: initialPrefs?.chat_enabled ?? false,
  })

  const [loading, setLoading] = useState(false)
  const [testPushLoading, setTestPushLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // 1. Detect browser environment
    const isSupp = isPushSupported()
    setSupported(isSupp)
    setIsIos(isIosDevice())
    setIsPwa(isStandalonePwa())

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }

    // 2. Check if this device is already subscribed
    if (isSupp) {
      registerServiceWorker().catch(() => {})
      getExistingSubscription().then((sub) => {
        setIsSubscribed(Boolean(sub))
      })
    }
  }, [])

  // Auto-dismiss feedback message after 4s
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  async function handleEnablePush() {
    setLoading(true)
    setFeedback(null)

    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error('Push configuration is missing on the server (VAPID key).')
      }

      const subscriptionData = await subscribeToPush(vapidPublicKey)
      if (!subscriptionData) {
        throw new Error('Failed to create push subscription on this device.')
      }

      // Save to Supabase
      const saveRes = await savePushSubscription(subscriptionData)
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Failed to save subscription to database.')
      }

      // Default category preferences: new_day: true, announcements: true, chat: false
      await updateNotificationPreferences({
        new_day_enabled: true,
        announcements_enabled: true,
        chat_enabled: false,
      })

      setPermission('granted')
      setIsSubscribed(true)
      setPrefs((p) => ({
        ...p,
        new_day_enabled: true,
        announcements_enabled: true,
        chat_enabled: false,
      }))

      setFeedback({
        type: 'success',
        message: 'Push notifications successfully activated for this device!',
      })
    } catch (err) {
      console.error('Failed to enable push notifications:', err)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission)
      }
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not enable push notifications.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDisablePush() {
    setLoading(true)
    setFeedback(null)

    try {
      const endpoint = await unsubscribeFromPush()
      if (endpoint) {
        await removePushSubscription(endpoint)
      }
      setIsSubscribed(false)
      setFeedback({
        type: 'success',
        message: 'Notifications disabled on this device.',
      })
    } catch (err) {
      console.error('Error disabling push notifications:', err)
      setFeedback({
        type: 'error',
        message: 'Failed to disable notifications.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleCategory(category: 'new_day_enabled' | 'announcements_enabled' | 'chat_enabled') {
    const nextVal = !prefs[category]
    setPrefs((prev) => ({ ...prev, [category]: nextVal }))

    try {
      const res = await updateNotificationPreferences({ [category]: nextVal })
      if (!res.success) {
        // Rollback on failure
        setPrefs((prev) => ({ ...prev, [category]: !nextVal }))
        setFeedback({ type: 'error', message: res.error || 'Failed to update category.' })
      }
    } catch (err) {
      setPrefs((prev) => ({ ...prev, [category]: !nextVal }))
      setFeedback({ type: 'error', message: 'Failed to save preference.' })
    }
  }

  async function handleSendTest() {
    setTestPushLoading(true)
    setFeedback(null)
    try {
      const res = await sendTestPushToSelf()
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Test notification sent! Check your device notification tray.',
        })
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Could not send test notification.',
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Failed to dispatch test notification.',
      })
    } finally {
      setTestPushLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--flame-accent)]">
            <BellRing size={15} strokeWidth={1.75} />
          </span>
          <h3 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider">
            Device Push Notifications
          </h3>
        </div>

        {permission === 'granted' && isSubscribed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--covenant-accent)] bg-[var(--covenant-subtle)] px-2 py-0.5 rounded-full border border-[var(--covenant-accent)]/20">
            <CheckCircle2 size={11} strokeWidth={2} />
            <span>Active</span>
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-3">
        Real device alerts that appear in your phone or browser notification tray. In-app bell and dots keep working independently.
      </p>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-lg text-xs font-medium mb-3 flex items-center gap-2 transition-all ${
            feedback.type === 'success'
              ? 'bg-[var(--covenant-subtle)] text-[var(--covenant-accent)] border border-[var(--covenant-accent)]/30'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <AlertCircle size={14} className="shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Case 1: iOS Safari not installed as PWA Home Screen App */}
      {isIos && !isPwa && (
        <div className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] mb-3">
          <div className="flex items-start gap-2">
            <Smartphone size={16} className="text-[var(--flame-accent)] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text-ink)] text-xs mb-1">
                iOS Safari Setup Required
              </p>
              <p className="text-[11px] leading-relaxed">
                Apple requires web apps to be installed to the Home Screen to receive push notifications.
                Tap the <strong className="text-[var(--text-ink)] inline-flex items-center gap-0.5"><Share size={10} /> Share</strong> button in Safari, then tap <strong className="text-[var(--text-ink)]">&quot;Add to Home Screen&quot;</strong>. Open the app from your Home Screen to enable notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Case 2: Browser does not support Push */}
      {supported === false && (
        <div className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
          <p className="font-semibold text-[var(--text-ink)] mb-0.5">Browser Not Supported</p>
          <p className="text-[11px] leading-relaxed">
            This browser does not support the Web Push API. You will still receive all pastoral notices and updates via the in-app notification bell and navigation badges.
          </p>
        </div>
      )}

      {/* Case 3: Permission Denied */}
      {supported !== false && permission === 'denied' && (
        <div className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
          <div className="flex items-start gap-2">
            <BellOff size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text-ink)] mb-0.5">Notifications Blocked</p>
              <p className="text-[11px] leading-relaxed">
                Notifications are blocked in your browser settings. To receive device alerts, open your browser site settings and allow notifications for this site.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Case 4: Permission Default or Not Subscribed (Prompt State) */}
      {supported !== false && permission !== 'denied' && !isSubscribed && (
        <div className="bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl p-3.5 text-center">
          <div className="w-9 h-9 mx-auto rounded-full bg-[var(--bg-surface)] text-[var(--flame-accent)] flex items-center justify-center mb-2 border border-[var(--border-hairline)]">
            <Bell size={16} strokeWidth={1.75} />
          </div>
          <p className="text-xs font-semibold text-[var(--text-ink)]">
            Enable Consecration Alerts
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs mx-auto leading-relaxed">
            Get instant alerts when the new morning consecration day opens and when church leadership broadcasts announcements.
          </p>

          <button
            type="button"
            onClick={handleEnablePush}
            disabled={loading}
            className="mt-3 w-full py-2 px-3 rounded-lg bg-[var(--flame-accent)] text-white text-xs font-semibold hover:opacity-90 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Enabling Device Alerts...</span>
              </>
            ) : (
              <>
                <BellRing size={13} strokeWidth={2} />
                <span>Enable Push Notifications</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Case 5: Subscribed & Active -> Category Toggles */}
      {supported !== false && isSubscribed && (
        <div className="space-y-3 pt-1">
          {/* Notification Categories */}
          <div className="divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)] py-1">
            {/* Category 1: New Challenge Day */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-ink)]">
                  New challenge day
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Alerts when the new morning consecration day and disciplines go live.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={prefs.new_day_enabled}
                onClick={() => handleToggleCategory('new_day_enabled')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  prefs.new_day_enabled ? 'bg-[var(--flame-accent)]' : 'bg-[var(--bg-subtle)] border-[var(--border-hairline)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    prefs.new_day_enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Category 2: Announcements */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-ink)]">
                  Announcements
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Pastoral notices, urgent directives, and challenge updates.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={prefs.announcements_enabled}
                onClick={() => handleToggleCategory('announcements_enabled')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  prefs.announcements_enabled ? 'bg-[var(--flame-accent)]' : 'bg-[var(--bg-subtle)] border-[var(--border-hairline)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    prefs.announcements_enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Category 3: Chat messages (default OFF) */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-[var(--text-ink)]">
                    Chat messages
                  </p>
                  <span className="text-[9px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.2 rounded border border-[var(--border-hairline)]">
                    Coming soon
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Community prayer wall messages and fellowship replies.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={prefs.chat_enabled}
                onClick={() => handleToggleCategory('chat_enabled')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  prefs.chat_enabled ? 'bg-[var(--flame-accent)]' : 'bg-[var(--bg-subtle)] border-[var(--border-hairline)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    prefs.chat_enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Device Actions: Send Test Push & Unsubscribe */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testPushLoading}
              className="text-[11px] font-semibold text-[var(--text-ink)] bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-hairline)] px-2.5 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {testPushLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} strokeWidth={1.75} />
              )}
              <span>Send Test Alert</span>
            </button>

            <button
              type="button"
              onClick={handleDisablePush}
              disabled={loading}
              className="text-[11px] text-[var(--text-muted)] hover:text-red-500 transition cursor-pointer underline"
            >
              Disable on this device
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
