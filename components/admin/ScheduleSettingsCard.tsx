'use client'

import { useState, useTransition } from 'react'
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
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-zinc-100">
              Challenge Configuration &amp; Temporal Synchronization
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
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
              className="text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              {isSeeding ? 'Initializing…' : `⚡ Initialize ${durationDays} Days`}
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700">
            🔒 Pastoral Key Locked
          </span>
        </div>
      </div>

      {/* Live Preview Badge */}
      <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
            Dynamic Branding Live Preview
          </span>
          <p className="text-base font-black text-gray-900 dark:text-zinc-50 mt-0.5">
            {renderedPreview}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300/80 font-medium">
            This title will appear dynamically across member dashboards, login banners, and certificates.
          </p>
        </div>
        <span className="text-xs font-bold bg-amber-500 text-white px-3 py-1 rounded-lg shadow-sm shrink-0">
          Preview
        </span>
      </div>

      {/* Critical Temporal Modification Warning */}
      {isStarted && (
        <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 flex items-start gap-3">
          <span className="text-amber-600 dark:text-amber-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
          <div className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
            <p className="font-bold">Challenge In Progress</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300/90 font-medium">
              The challenge has already started. Changing the duration, challenge name, or start date
              will immediately shift the active day index for all members and alter universal streak
              calculations.
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Duration Days */}
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
              Challenge Duration (Days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              required
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 text-xs font-bold transition-all bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            />
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
              e.g. 21, 40, or 90 days
            </p>
          </div>

          {/* Challenge Name */}
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
              Challenge Theme Name
            </label>
            <input
              type="text"
              required
              value={challengeName}
              onChange={(e) => setChallengeName(e.target.value)}
              placeholder="e.g. Overcomer, Purpose, Dominion"
              className="w-full px-3.5 py-2 text-xs font-bold transition-all bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            />
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
              Forms &quot;{durationDays} Days of {challengeName.trim() || '…'}&quot;
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
              Challenge Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-bold transition-all bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            />
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
              Determines Day 1 universal activation
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
              Fellowship Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-bold transition-all bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer"
            >
              <option value="Africa/Lagos">
                West Africa Time (WAT) - GMT+1 (Ile-Ife Local)
              </option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="America/New_York">New York (EST/EDT)</option>
            </select>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
              Synced to BBCC Ile-Ife Tabernacle
            </p>
          </div>
        </div>

        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded-xl font-medium ${
              msg.type === 'success'
                ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-gray-500 dark:text-zinc-400">
            Current layout: <strong className="text-gray-800 dark:text-zinc-200">{durationDays} total days</strong>
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-gray-950 dark:bg-zinc-800 hover:bg-gray-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
          >
            {isPending ? 'Saving…' : 'Save Challenge Settings'}
          </button>
        </div>
      </form>
    </section>
  )
}
