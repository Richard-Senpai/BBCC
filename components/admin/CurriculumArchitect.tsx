'use client'

import { useState, useTransition } from 'react'
import { saveChallengeDay } from '@/lib/actions/admin'
import type { ChallengeDayWithActivities, DayCompletionCount } from '@/lib/types'

interface CurriculumArchitectProps {
  days: ChallengeDayWithActivities[]
  completionCounts: DayCompletionCount[]
  startDate: string | null
  durationDays?: number
  challengeName?: string
}

export default function CurriculumArchitect({
  days,
  completionCounts,
  startDate,
  durationDays = 40,
  challengeName = 'Overcomer',
}: CurriculumArchitectProps) {
  // Map days by day_number for instant lookup
  const dayMap = new Map<number, ChallengeDayWithActivities>()
  days.forEach((d) => dayMap.set(d.day_number, d))

  const countMap = new Map<number, number>()
  completionCounts.forEach((c) => countMap.set(c.day_number, c.completion_count))

  const [selectedDayNum, setSelectedDayNum] = useState<number>(1)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Selected day form state
  const selectedDay = dayMap.get(selectedDayNum)

  const [title, setTitle] = useState(
    selectedDay?.title ?? `Day ${selectedDayNum}: Consecration & Spiritual Discipline`
  )
  const [scripture, setScripture] = useState(
    selectedDay?.scripture_reference ?? 'Galatians 5:16-25 & Romans 8:1-14'
  )
  const [description, setDescription] = useState(
    selectedDay?.description ?? ''
  )
  const [activities, setActivities] = useState<
    { id?: string; description: string; sort_order: number }[]
  >(
    selectedDay?.activities && selectedDay.activities.length > 0
      ? selectedDay.activities.map((a) => ({
          id: a.id,
          description: a.description,
          sort_order: a.sort_order,
        }))
      : [
          { description: 'Morning Prayer Watch (30 mins personal devotion)', sort_order: 1 },
          { description: 'Scripture Meditation & Journaling', sort_order: 2 },
          { description: 'Midday Fasting & Fellowship Consecration', sort_order: 3 },
        ]
  )

  function handleSelectDay(num: number) {
    setSelectedDayNum(num)
    setFeedback(null)
    const d = dayMap.get(num)
    setTitle(d?.title ?? `Day ${num}: Consecration & Spiritual Discipline`)
    setScripture(d?.scripture_reference ?? 'Galatians 5:16-25 & Romans 8:1-14')
    setDescription(d?.description ?? '')
    setActivities(
      d?.activities && d.activities.length > 0
        ? d.activities.map((a) => ({
            id: a.id,
            description: a.description,
            sort_order: a.sort_order,
          }))
        : [
            { description: 'Morning Prayer Watch (30 mins personal devotion)', sort_order: 1 },
            { description: 'Scripture Meditation & Journaling', sort_order: 2 },
            { description: 'Midday Fasting & Fellowship Consecration', sort_order: 3 },
          ]
    )
  }

  function handleAddActivity() {
    setActivities([
      ...activities,
      {
        description: 'New devotional activity prompt',
        sort_order: activities.length + 1,
      },
    ])
  }

  function handleUpdateActivity(idx: number, newDesc: string) {
    const updated = [...activities]
    updated[idx].description = newDesc
    setActivities(updated)
  }

  function handleDeleteActivity(idx: number) {
    const updated = activities.filter((_, i) => i !== idx)
    setActivities(updated.map((a, i) => ({ ...a, sort_order: i + 1 })))
  }

  function handleMoveActivity(idx: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === activities.length - 1)
    ) {
      return
    }
    const updated = [...activities]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    setActivities(updated.map((a, i) => ({ ...a, sort_order: i + 1 })))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      try {
        await saveChallengeDay({
          dayNumber: selectedDayNum,
          title,
          description,
          scriptureReference: scripture,
          activities,
        })
        setFeedback({
          type: 'success',
          text: `Day ${selectedDayNum} content published successfully!`,
        })
      } catch (err) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Save failed',
        })
      }
    })
  }

  // Calculate target date for selected day
  const targetDateStr = (() => {
    if (!startDate) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + (selectedDayNum - 1))
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  // Calculate overall publishing counts
  const publishedCount = Array.from({ length: durationDays }, (_, i) => i + 1).filter(
    (n) => dayMap.has(n) && (dayMap.get(n)?.activities?.length ?? 0) > 0
  ).length

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800 mt-6 transition-colors">
      {/* Title & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏛️</span>
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-zinc-100">
              {durationDays}-Day Curriculum Matrix &amp; Content Architect
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Tap any day node to inspect details or preview publishing readiness for {durationDays} Days of {challengeName}.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
          <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            Published ({publishedCount})
          </span>
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-500 ring-offset-1 dark:ring-offset-zinc-900 inline-block" />
            Active Selection (Day {selectedDayNum})
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-400 dark:border-zinc-500 inline-block" />
            Needs Content ({Math.max(0, durationDays - publishedCount)})
          </span>
        </div>
      </div>

      {/* Main Grid: Roadmap on left (or top on mobile), Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* ── Left / Top: Roadmap Matrix (5 cols) ── */}
        <div className="lg:col-span-5 bg-gray-50/70 dark:bg-zinc-800/40 rounded-2xl p-4 border border-gray-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
              Cohort Full Roadmap (Days 1 — {durationDays})
            </span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">Click node to edit</span>
          </div>

          {/* Grid nodes */}
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {Array.from({ length: durationDays }, (_, i) => i + 1).map((num) => {
              const day = dayMap.get(num)
              const hasContent = day && (day.activities?.length ?? 0) > 0
              const isSelected = num === selectedDayNum
              const compCount = countMap.get(num) ?? 0

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectDay(num)}
                  className={`
                    relative flex flex-col items-center justify-center p-2 rounded-xl text-center transition
                    ${
                      isSelected
                        ? 'bg-amber-500 text-white ring-4 ring-amber-200 dark:ring-amber-500/40 shadow-md font-black scale-105 z-10'
                        : hasContent
                        ? 'bg-white dark:bg-zinc-800 border border-green-300 dark:border-green-800 text-gray-900 dark:text-zinc-100 hover:border-amber-400 hover:shadow-sm'
                        : 'bg-white/60 dark:bg-zinc-800/40 border border-dashed border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-gray-400'
                    }
                  `}
                >
                  <span className="text-xs font-black leading-none">{num}</span>
                  <span
                    className={`text-[8px] font-bold mt-1 leading-none ${
                      isSelected
                        ? 'text-white'
                        : hasContent
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  >
                    {hasContent ? 'Ready' : 'Empty'}
                  </span>
                  {compCount > 0 && (
                    <span
                      title={`${compCount} members completed`}
                      className={`text-[7px] font-bold mt-0.5 px-1 rounded-full ${
                        isSelected
                          ? 'bg-amber-700 text-white'
                          : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'
                      }`}
                    >
                      👤{compCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200/70 dark:border-zinc-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
            <span>✓ {publishedCount} Published to congregation</span>
            <span>{Math.max(0, durationDays - publishedCount)} drafts needed</span>
          </div>
        </div>

        {/* ── Right / Bottom: Selected Day Content Editor (7 cols) ── */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-amber-200/90 dark:border-zinc-800 shadow-sm transition-colors">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                  Selected: Day {selectedDayNum}
                </span>
                {targetDateStr && (
                  <span className="text-xs text-gray-400 dark:text-zinc-500 ml-2">
                    {targetDateStr}
                  </span>
                )}
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mt-1">
                  Day {selectedDayNum}: Edit Devotional &amp; Activities
                </h3>
              </div>

              {countMap.get(selectedDayNum) !== undefined && (
                <div className="text-right">
                  <span className="text-xs font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200/50 dark:border-green-800/40 px-2.5 py-1 rounded-full">
                    {countMap.get(selectedDayNum)} Completed
                  </span>
                </div>
              )}
            </div>

            {/* Day Title */}
            <div>
              <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
                Day Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Day 14: Walking in the Spirit — Consecrated Morning Prayer"
                className="w-full px-3.5 py-2 text-xs font-semibold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-sm placeholder:text-gray-400 dark:placeholder:text-zinc-500"
              />
            </div>

            {/* Scripture Reference */}
            <div>
              <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
                Scripture Reference
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={scripture}
                  onChange={(e) => setScripture(e.target.value)}
                  placeholder="e.g. Galatians 5:16-25 & Romans 8:1-14"
                  className="w-full px-3.5 py-2 pr-9 text-xs font-semibold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-sm placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm">
                  📖
                </span>
              </div>
            </div>

            {/* Devotional Exhortation */}
            <div>
              <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200 mb-1">
                Daily Devotional Summary &amp; Exhortation
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beloved BBCC family, today our focus deepens into true yieldedness..."
                className="w-full px-3.5 py-2 text-xs font-semibold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none transition shadow-sm placeholder:text-gray-400 dark:placeholder:text-zinc-500"
              />
            </div>

            {/* Daily Required Activities Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                  Daily Required Checklist ({activities.length} Activities)
                </label>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                  Reorder or customize
                </span>
              </div>

              <div className="space-y-2">
                {activities.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/80 p-2 rounded-xl border border-gray-200/80 dark:border-zinc-700 transition-colors"
                  >
                    {/* Reorder Buttons */}
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveActivity(idx, 'up')}
                        disabled={idx === 0}
                        aria-label="Move activity up"
                        className="text-[9px] text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-20 leading-none"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveActivity(idx, 'down')}
                        disabled={idx === activities.length - 1}
                        aria-label="Move activity down"
                        className="text-[9px] text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-20 leading-none"
                      >
                        ▼
                      </button>
                    </div>

                    <span className="w-5 h-5 rounded-full bg-green-500 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      value={act.description}
                      onChange={(e) => handleUpdateActivity(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                    />

                    <button
                      type="button"
                      onClick={() => handleDeleteActivity(idx)}
                      title="Remove activity"
                      className="w-6 h-6 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center text-xs transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddActivity}
                className="mt-2.5 w-full py-2 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-gray-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                + Add New Activity Prompt
              </button>
            </div>

            {feedback && (
              <div
                className={`text-xs px-3 py-2 rounded-xl font-medium ${
                  feedback.type === 'success'
                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition"
            >
              💾 {isPending ? 'Publishing…' : `Save & Publish Day ${selectedDayNum}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
