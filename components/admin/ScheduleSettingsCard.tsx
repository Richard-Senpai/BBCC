'use client'

import { useState, useTransition } from 'react'
import { updateChallengeSettings, seed40Days } from '@/lib/actions/admin'
import type { ChallengeSettings } from '@/lib/types'

interface ScheduleSettingsCardProps {
  settings: ChallengeSettings | null
  hasChallengeDays: boolean
}

export default function ScheduleSettingsCard({
  settings,
  hasChallengeDays,
}: ScheduleSettingsCardProps) {
  const [startDate, setStartDate] = useState(settings?.start_date ?? '')
  const [timezone, setTimezone] = useState(settings?.timezone ?? 'Africa/Lagos')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSeeding, startSeedTransition] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      try {
        await updateChallengeSettings(startDate || null, timezone)
        setMsg({ type: 'success', text: 'Schedule settings updated successfully!' })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' })
      }
    })
  }

  function handleSeed() {
    if (!confirm('This will populate days 1 to 40 with template titles and default activities. Proceed?')) {
      return
    }
    setMsg(null)
    startSeedTransition(async () => {
      try {
        await seed40Days()
        setMsg({ type: 'success', text: 'All 40 days successfully initialized!' })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Initialization failed' })
      }
    })
  }

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <div>
            <h2 className="text-base font-black text-gray-900">
              Challenge Schedule &amp; Temporal Synchronization
            </h2>
            <p className="text-xs text-gray-500">
              Define master synchronization clocks for the BBCC assembly in Ile-Ife.
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
              {isSeeding ? 'Initializing…' : '⚡ Initialize 40 Days'}
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
            🔒 Pastoral Key Locked
          </span>
        </div>
      </div>

      {/* Critical Temporal Modification Warning */}
      <div className="mt-4 bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
        <span className="text-amber-600 text-lg flex-shrink-0 mt-0.5">⚠️</span>
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold">Critical Temporal Modification Warning</p>
          <p className="mt-0.5 text-amber-800">
            Changing the start date or timezone while the 40-day challenge is actively
            running will shift the current day index for all members and will adjust
            universal streak calculations.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Challenge Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Determines Day 1 universal activation
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Fellowship Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            >
              <option value="Africa/Lagos">
                West Africa Time (WAT) - GMT+1 (Ile-Ife Local)
              </option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="America/New_York">New York (EST/EDT)</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Synced to BBCC Ile-Ife Tabernacle
            </p>
          </div>

          {/* Reset Time (Display only per design) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Daily Devotional Reset Time
            </label>
            <input
              type="text"
              readOnly
              value="00:00 WAT (Midnight)"
              className="w-full px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300 rounded-xl cursor-not-allowed"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Members refresh progress at this hour
            </p>
          </div>
        </div>

        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded-xl font-medium ${
              msg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-800 font-medium"
          >
            📋 Audit Log (12 Changes)
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
          >
            {isPending ? 'Saving…' : 'Save Schedule Settings'}
          </button>
        </div>
      </form>
    </section>
  )
}
