'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleActivityCompletion } from '@/lib/actions/completions'
import type { Activity } from '@/lib/types'

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
        <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
          Daily Consecration Checklist
        </h3>
        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
          {doneCount} of {total} Done
        </span>
      </div>

      {/* Activity rows */}
      <div className="space-y-2.5">
        {sorted.map((activity) => {
          const done = optimisticDone.has(activity.id)
          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => handleToggle(activity.id)}
              disabled={!isToday}
              className={`
                w-full flex items-start gap-3 p-3 rounded-xl border text-left
                transition-all duration-150
                ${
                  done
                    ? 'bg-green-50/90 dark:bg-green-950/30 border-green-300 dark:border-green-800/60'
                    : 'bg-white dark:bg-zinc-800/90 border-gray-200 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-400'
                }
                ${!isToday ? 'opacity-70 cursor-default' : 'cursor-pointer active:scale-[0.99]'}
              `}
            >
              {/* Circle indicator */}
              <div
                className={`
                  mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                  border-2 transition-all
                  ${
                    done
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                  }
                `}
              >
                {done && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold leading-snug ${
                    done
                      ? 'text-gray-400 dark:text-zinc-500 line-through'
                      : 'text-gray-900 dark:text-zinc-100'
                  }`}
                >
                  {activity.description}
                </p>
                {!done && isToday && (
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 font-medium">
                    Pending
                  </p>
                )}
                {done && (
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 font-bold">
                    Completed ✓
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Spiritual Reflections textarea */}
      <div className="mt-4">
        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
          Spiritual Reflections &amp; Journal Note
        </label>
        <textarea
          placeholder="Write today's revelations, prayers, or answers received during communion with the Lord…"
          rows={3}
          disabled={!isToday}
          className="mt-1.5 w-full text-sm font-medium p-3 rounded-xl border transition-all resize-none bg-white text-gray-950 placeholder:text-gray-400 border-gray-300 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-amber-400 shadow-sm disabled:opacity-60"
        />
      </div>

      {/* CTA Button */}
      {isToday && total > 0 && (
        <button
          type="button"
          className={`
            w-full mt-4 py-3.5 rounded-xl font-bold text-white text-sm
            flex items-center justify-center gap-2 transition-all shadow-md
            ${
              allDone
                ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
            }
          `}
        >
          {allDone ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Day {dayNumber} Complete!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Mark Day {dayNumber} Complete ({doneCount} of {total} done)
            </>
          )}
        </button>
      )}
    </div>
  )
}
