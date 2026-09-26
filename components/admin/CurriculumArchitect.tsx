'use client'

import { useState, useTransition } from 'react'
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Users,
} from 'lucide-react'
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
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] mt-6 transition-colors">
      {/* Title & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-hairline)] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--flame-accent)]">
            <BookOpen size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              {durationDays}-Day Curriculum Matrix &amp; Content Architect
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Select any day node to inspect details or preview publishing readiness for {durationDays} Days of {challengeName}.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium flex-wrap">
          <span className="flex items-center gap-1.5 text-[var(--olive-accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--olive-accent)] inline-block" />
            Published ({publishedCount})
          </span>
          <span className="flex items-center gap-1.5 text-[var(--flame-accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--flame-accent)] inline-block" />
            Selected (Day {selectedDayNum})
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full border border-dashed border-[var(--text-muted)] inline-block" />
            Needs Content ({Math.max(0, durationDays - publishedCount)})
          </span>
        </div>
      </div>

      {/* Main Grid: Roadmap on left, Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* ── Left / Top: Roadmap Matrix (5 cols) ── */}
        <div className="lg:col-span-5 bg-[var(--bg-subtle)] rounded-xl p-4 border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[var(--text-ink)] uppercase tracking-wider">
              Roadmap (Days 1 — {durationDays})
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">Click node to edit</span>
          </div>

          {/* Grid nodes */}
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
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
                    relative flex flex-col items-center justify-center p-1.5 rounded-lg text-center transition cursor-pointer
                    ${
                      isSelected
                        ? 'bg-[var(--flame-accent)] text-white shadow-xs font-bold scale-105 z-10'
                        : hasContent
                        ? 'bg-[var(--bg-surface)] border border-[var(--olive-accent)]/50 text-[var(--text-ink)] hover:border-[var(--flame-accent)]'
                        : 'bg-[var(--bg-surface)]/50 border border-dashed border-[var(--border-hairline)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                    }
                  `}
                >
                  <span className="text-xs font-semibold leading-none">{num}</span>
                  <span
                    className={`text-[8px] font-medium mt-1 leading-none ${
                      isSelected
                        ? 'text-white/90'
                        : hasContent
                        ? 'text-[var(--olive-accent)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {hasContent ? 'Ready' : 'Empty'}
                  </span>
                  {compCount > 0 && (
                    <span
                      title={`${compCount} members completed`}
                      className={`text-[7px] font-medium mt-0.5 px-1 rounded flex items-center gap-0.5 ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Users size={8} />
                      {compCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{publishedCount} Published</span>
            <span>{Math.max(0, durationDays - publishedCount)} drafts needed</span>
          </div>
        </div>

        {/* ── Right / Bottom: Selected Day Content Editor (7 cols) ── */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs transition-colors">
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-hairline)]">
                  Selected: Day {selectedDayNum}
                </span>
                {targetDateStr && (
                  <span className="text-xs text-[var(--text-muted)] ml-2">
                    {targetDateStr}
                  </span>
                )}
                <h3 className="text-xs font-semibold text-[var(--text-ink)] mt-1">
                  Day {selectedDayNum}: Edit Devotional &amp; Activities
                </h3>
              </div>

              {countMap.get(selectedDayNum) !== undefined && (
                <div className="text-right">
                  <span className="text-xs font-medium text-[var(--olive-accent)] bg-[var(--bg-subtle)] border border-[var(--border-hairline)] px-2 py-0.5 rounded-full">
                    {countMap.get(selectedDayNum)} Completed
                  </span>
                </div>
              )}
            </div>

            {/* Day Title */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Day Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Day 14: Walking in the Spirit — Consecrated Morning Prayer"
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-xs placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Scripture Reference */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Scripture Reference
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={scripture}
                  onChange={(e) => setScripture(e.target.value)}
                  placeholder="e.g. Galatians 5:16-25 & Romans 8:1-14"
                  className="w-full px-3 py-1.5 pr-8 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-xs placeholder:text-[var(--text-muted)]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <BookOpen size={13} strokeWidth={1.75} />
                </span>
              </div>
            </div>

            {/* Devotional Exhortation */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Daily Devotional Summary &amp; Exhortation
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beloved BBCC family, today our focus deepens into true yieldedness..."
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] resize-none transition shadow-xs placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Daily Required Activities Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-[var(--text-ink)]">
                  Required Activities ({activities.length})
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Reorder or customize
                </span>
              </div>

              <div className="space-y-1.5">
                {activities.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-[var(--bg-subtle)] p-2 rounded-lg border border-[var(--border-hairline)] transition-colors"
                  >
                    {/* Reorder Buttons */}
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => handleMoveActivity(idx, 'up')}
                        disabled={idx === 0}
                        aria-label="Move activity up"
                        className="text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronUp size={11} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveActivity(idx, 'down')}
                        disabled={idx === activities.length - 1}
                        aria-label="Move activity down"
                        className="text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronDown size={11} strokeWidth={2} />
                      </button>
                    </div>

                    <span className="w-4 h-4 rounded-full bg-[var(--olive-accent)] text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      value={act.description}
                      onChange={(e) => handleUpdateActivity(idx, e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
                    />

                    <button
                      type="button"
                      onClick={() => handleDeleteActivity(idx)}
                      title="Remove activity"
                      className="w-6 h-6 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddActivity}
                className="mt-2 w-full py-1.5 border border-dashed border-[var(--border-hairline)] hover:border-[var(--flame-accent)] text-[var(--text-muted)] hover:text-[var(--flame-accent)] font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={12} strokeWidth={1.75} />
                <span>Add Activity Prompt</span>
              </button>
            </div>

            {feedback && (
              <div
                className={`text-xs px-3 py-2 rounded-lg font-medium ${
                  feedback.type === 'success'
                    ? 'bg-green-500/10 text-[var(--olive-accent)] border border-green-500/25'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Check size={13} strokeWidth={2} />
              <span>{isPending ? 'Publishing…' : `Save & Publish Day ${selectedDayNum}`}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
