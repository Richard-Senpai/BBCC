'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleActivityCompletion } from '@/lib/actions/completions'
import type { Activity } from '@/lib/types'

interface ActivityChecklistProps {
  dayId: string
  dayNumber: number
  activities: Activity[]
  /** Array of activity IDs the user has already completed */
  initialCompletedIds: string[]
  isDayComplete: boolean
  /** Only today's day is interactive; past days are read-only */
  isToday: boolean
}

export default function ActivityChecklist({
  dayId,
  dayNumber,
  activities,
  initialCompletedIds,
  isToday,
}: ActivityChecklistProps) {
  // useOptimistic gives an instant local state that reverts to the
  // server state once the Server Action settles.
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
        <h3 className="font-bold text-gray-900 text-sm">
          Daily Consecration Checklist
        </h3>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
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
                ${done
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-amber-300'
                }
                ${!isToday ? 'opacity-70 cursor-default' : 'cursor-pointer active:scale-[0.99]'}
              `}
            >
              {/* Circle indicator */}
              <div
                className={`
                  mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                  border-2 transition-all
                  ${done
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 bg-white'
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
                <p className={`text-sm font-medium leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {activity.description}
                </p>
                {!done && isToday && (
                  <p className="text-xs text-gray-400 mt-0.5">Pending</p>
                )}
                {done && (
                  <p className="text-xs text-green-600 mt-0.5 font-medium">Completed ✓</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Spiritual Reflections textarea */}
      <div className="mt-4">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Spiritual Reflections &amp; Journal Note
        </label>
        <textarea
          placeholder="Write today's revelations, prayers, or answers received during communion with the Lord…"
          rows={3}
          disabled={!isToday}
          className="mt-1.5 w-full text-sm text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-60"
        />
      </div>

      {/* CTA Button */}
      {isToday && total > 0 && (
        <button
          type="button"
          className={`
            w-full mt-4 py-3.5 rounded-xl font-bold text-white text-sm
            flex items-center justify-center gap-2 transition-all
            ${allDone
              ? 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200'
              : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200'
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
