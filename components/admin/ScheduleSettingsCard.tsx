'use client'

import { useState, useTransition } from 'react'
import { Settings, Sparkles, Lock, AlertTriangle } from 'lucide-react'
import { updateChallengeSettings, seedChallengeDays } from '@/lib/actions/admin'
import type { ChallengeSettings } from '@/lib/types'

interface ScheduleSettingsCardProps {
  settings: ChallengeSettings | null
  hasChallengeDays: boolean
  existingDaysCount?: number
}

export default function ScheduleSettingsCard({
  settings,
  hasChallengeDays,
  existingDaysCount = 0,
}: ScheduleSettingsCardProps) {
  const [durationDays, setDurationDays] = useState<number>(settings?.duration_days ?? 40)
  const [challengeName, setChallengeName] = useState<string>(settings?.challenge_name ?? 'Overcomer')
  const [startDate, setStartDate] = useState(settings?.start_date ?? '')
  const [timezone, setTimezone] = useState(settings?.timezone ?? 'Africa/Lagos')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSeeding, startSeedTransition] = useTransition()

  const initialDuration = settings?.duration_days ?? 40
  const initialName = settings?.challenge_name ?? 'Overcomer'
  const initialStartDate = settings?.start_date ?? ''

  // Determine if challenge has already started
  const isStarted = Boolean(settings?.start_date && new Date(settings.start_date) <= new Date())

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    // Check if challenge is already underway and critical settings changed
    const hasActiveModifications =
      isStarted &&
      (startDate !== initialStartDate ||
        durationDays !== initialDuration ||
        challengeName.trim() !== initialName)

    if (hasActiveModifications) {
      const confirmed = window.confirm(
        `CRITICAL TEMPORAL WARNING:\n\nThe challenge is currently active! Modifying the duration (${initialDuration} -> ${durationDays} days), challenge name, or start date will shift what day members are on today and adjust active streak calculations.\n\nDo you want to apply these changes?`
      )
      if (!confirmed) return
    }

    // Check if duration shortened below existing day curriculum
    if (existingDaysCount > 0 && durationDays < existingDaysCount) {
      const confirmed = window.confirm(
        `CURRICULUM WARNING:\n\nYou currently have ${existingDaysCount} challenge days created. Shortening the duration to ${durationDays} days will hide days ${durationDays + 1} to ${existingDaysCount} from members.\n\nYour existing day content will NOT be deleted, but members will only be able to view and complete days 1 to ${durationDays}.\n\nProceed with shortening?`
      )
      if (!confirmed) return
    }

    startTransition(async () => {
      try {
        await updateChallengeSettings(
          startDate || null,
          timezone,
          durationDays,
          challengeName.trim() || 'Overcomer'
        )
        setMsg({ type: 'success', text: 'Schedule & challenge settings updated successfully!' })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' })
      }
    })
  }

  function handleSeed() {
    if (
      !confirm(
        `This will populate days 1 to ${durationDays} with template titles and default activities for "${durationDays} Days of ${challengeName.trim() || 'Overcomer'}". Proceed?`
      )
    ) {
      return
    }
    setMsg(null)
    startSeedTransition(async () => {
      try {
        const res = await seedChallengeDays()
        setMsg({ type: 'success', text: `All ${res.count ?? durationDays} days successfully initialized!` })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Initialization failed' })
      }
    })
  }

  const renderedPreview = `${durationDays} Days of ${challengeName.trim() || 'Overcomer'}`

  return (
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-hairline)] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--flame-accent)]">
            <Settings size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Challenge Configuration &amp; Temporal Synchronization
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Set challenge name, total duration, start date, and fellowship master clocks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!hasChallengeDays && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
              className="text-xs font-medium bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={12} strokeWidth={1.75} />
              <span>{isSeeding ? 'Initializing…' : `Initialize ${durationDays} Days`}</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border-hairline)]">
            <Lock size={12} strokeWidth={1.75} />
            <span>Pastoral Key Locked</span>
          </span>
        </div>
      </div>

      {/* Live Preview Badge */}
      <div className="mt-4 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--flame-accent)]">
            Dynamic Branding Live Preview
          </span>
          <p className="text-sm font-semibold text-[var(--text-ink)] mt-0.5">
            {renderedPreview}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            This title will appear dynamically across member dashboards, login banners, and certificates.
          </p>
        </div>
        <span className="text-xs font-medium text-[var(--flame-accent)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-md border border-[var(--border-hairline)] shrink-0">
          Live Preview
        </span>
      </div>

      {/* Critical Temporal Modification Warning */}
      {isStarted && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 flex items-start gap-2.5">
          <span className="text-[var(--flame-accent)] shrink-0 mt-0.5">
            <AlertTriangle size={15} strokeWidth={1.75} />
          </span>
          <div className="text-xs text-[var(--text-ink)] leading-relaxed">
            <p className="font-semibold text-[var(--flame-accent)]">Challenge In Progress</p>
            <p className="mt-0.5 text-[var(--text-muted)]">
              The challenge has already started. Changing the duration, challenge name, or start date
              will immediately shift the active day index for all members and alter universal streak
              calculations.
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Duration Days */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
              Challenge Duration (Days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              required
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              e.g. 21, 40, or 90 days
            </p>
          </div>

          {/* Challenge Name */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
              Challenge Theme Name
            </label>
            <input
              type="text"
              required
              value={challengeName}
              onChange={(e) => setChallengeName(e.target.value)}
              placeholder="e.g. Overcomer, Purpose, Dominion"
              className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Forms &quot;{durationDays} Days of {challengeName.trim() || '…'}&quot;
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
              Challenge Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Determines Day 1 universal activation
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
              Fellowship Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
            >
              <option value="Africa/Lagos">
                West Africa Time (WAT) - GMT+1 (Ile-Ife Local)
              </option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="America/New_York">New York (EST/EDT)</option>
            </select>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Synced to BBCC Ile-Ife Sanctuary
            </p>
          </div>
        </div>

        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded-lg font-medium ${
              msg.type === 'success'
                ? 'bg-green-500/10 text-[var(--olive-accent)] border border-green-500/25'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--text-muted)]">
            Current layout: <strong className="text-[var(--text-ink)] font-semibold">{durationDays} total days</strong>
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            {isPending ? 'Saving…' : 'Save Challenge Settings'}
          </button>
        </div>
      </form>
    </section>
  )
}
