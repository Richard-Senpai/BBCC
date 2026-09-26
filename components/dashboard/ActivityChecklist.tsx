'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleActivityCompletion } from '@/lib/actions/completions'
import type { Activity } from '@/lib/types'
import { Check, CheckCircle2, Circle, Play } from 'lucide-react'

interface ActivityChecklistProps {
  dayId: string
  dayNumber: number
  activities: Activity[]
  initialCompletedIds: string[]
  isDayComplete: boolean
  isToday: boolean
}

export default function ActivityChecklist({
  dayId,
  dayNumber,
  activities,
  initialCompletedIds,
  isToday,
}: ActivityChecklistProps) {
  const [optimisticDone, toggleOptimistic] = useOptimistic(
    new Set(initialCompletedIds),
    (current: Set<string>, activityId: string) => {
      const next = new Set(current)
      if (next.has(activityId)) next.delete(activityId)
      else next.add(activityId)
      return next
    }
  )

  const [, startTransition] = useTransition()

  function handleToggle(activityId: string) {
    if (!isToday) return
    startTransition(async () => {
      toggleOptimistic(activityId)
      await toggleActivityCompletion(activityId, dayId)
    })
  }

  const sorted = [...activities].sort((a, b) => a.sort_order - b.sort_order)
  const doneCount = sorted.filter((a) => optimisticDone.has(a.id)).length
  const total = sorted.length
  const allDone = doneCount === total && total > 0

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[var(--text-ink)] text-sm tracking-tight">
          Daily Consecration Disciplines
        </h3>
        <span className="text-xs font-semibold text-[var(--covenant-accent)] bg-[var(--covenant-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--covenant-accent)]/20">
          {doneCount} of {total} completed
        </span>
      </div>

      {/* Activity rows */}
      <div className="space-y-2">
        {sorted.map((activity) => {
          const done = optimisticDone.has(activity.id)
          return (
            <div
              key={activity.id}
              className={`
                w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border
                transition-all duration-150
                ${
                  done
                    ? 'bg-[var(--covenant-subtle)] border-[var(--covenant-accent)]/25'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--flame-accent)]/50'
                }
              `}
            >
              {/* Checkbox indicator & Text button */}
              <button
                type="button"
                onClick={() => handleToggle(activity.id)}
                disabled={!isToday}
                className={`
                  flex items-start gap-3 min-w-0 flex-1 text-left
                  ${!isToday ? 'opacity-75 cursor-default' : 'cursor-pointer active:scale-[0.99]'}
                `}
              >
                {/* Checkbox indicator with deliberate motion spring */}
                <div
                  className={`
                    mt-0.5 w-5 h-5 rounded-md shrink-0 flex items-center justify-center
                    border transition-all
                    ${
                      done
                        ? 'bg-[var(--covenant-accent)] border-[var(--covenant-accent)] text-white shadow-2xs animate-check-spring'
                        : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                    }
                  `}
                >
                  {done && (
                    <Check size={13} strokeWidth={2.5} className="text-white" />
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-snug ${
                      done
                        ? 'text-[var(--text-muted)] line-through decoration-[var(--border-strong)]'
                        : 'text-[var(--text-ink)]'
                    }`}
                  >
                    {activity.description}
                  </p>
                  {!done && isToday && (
                    <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                      Today&apos;s spiritual discipline
                    </p>
                  )}
                  {done && (
                    <p className="text-[11px] text-[var(--covenant-accent)] mt-0.5 font-medium flex items-center gap-1">
                      Completed
                    </p>
                  )}
                </div>
              </button>

              {/* Separate Video Link Tap Target */}
              {activity.video_url && (
                <div className="shrink-0 pl-1 border-l border-[var(--border-subtle)] flex items-center">
                  <a
                    href={activity.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      // Prevent event bubbling to any ancestor
                      e.stopPropagation()
                    }}
                    title="Watch attached video guidance"
                    aria-label={`Watch video for ${activity.description}`}
                    className="
                      flex items-center justify-center gap-1.5
                      min-w-[42px] min-h-[42px] px-2.5 py-1.5 rounded-lg
                      bg-[var(--bg-subtle)] hover:bg-[var(--flame-subtle)]
                      border border-[var(--border-subtle)] hover:border-[var(--flame-accent)]/40
                      text-[var(--flame-accent)]
                      transition active:scale-95 shadow-2xs
                      cursor-pointer
                    "
                  >
                    <Play size={13} strokeWidth={2.2} className="fill-[var(--flame-accent)]" />
                    <span className="text-[11px] font-semibold hidden sm:inline">Watch</span>
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Spiritual Reflections textarea */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
          Spiritual Reflections &amp; Journal Note
        </label>
        <textarea
          placeholder="Record today&apos;s revelations, scripture insights, or prayers during devotion…"
          rows={3}
          disabled={!isToday}
          className="bbcc-input resize-none disabled:opacity-60"
        />
      </div>

      {/* Status Banner */}
      {isToday && total > 0 && allDone && (
        <div className="mt-4 py-3 px-4 rounded-xl bg-[var(--covenant-subtle)] border border-[var(--covenant-accent)]/30 text-[var(--covenant-accent)] text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 size={16} strokeWidth={2} />
          <span>Day {dayNumber} Consecration Complete</span>
        </div>
      )}
    </div>
  )
}

