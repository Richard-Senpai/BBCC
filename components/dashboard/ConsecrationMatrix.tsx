interface ConsecrationMatrixProps {
  /** 1–40: the active challenge day. null/0 if not started */
  currentDay: number | null
  /** Set of day numbers the user has fully completed */
  completedDayNumbers: number[]
  totalCompleted: number
  /** Whether to show a compact version (dashboard) vs full (progress page) */
  compact?: boolean
}

type DayStatus = 'completed' | 'current' | 'missed' | 'upcoming'

function getDayStatus(
  dayNumber: number,
  currentDay: number | null,
  completedSet: Set<number>
): DayStatus {
  if (completedSet.has(dayNumber)) return 'completed'
  if (dayNumber === currentDay) return 'current'
  if (currentDay !== null && dayNumber < currentDay) return 'missed'
  return 'upcoming'
}

const statusStyles: Record<DayStatus, string> = {
  completed: 'bg-green-500 text-white shadow-sm',
  current:   'bg-amber-500 text-white ring-2 ring-amber-300 dark:ring-amber-500 ring-offset-1 dark:ring-offset-zinc-900 shadow-sm font-black',
  missed:    'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500',
  upcoming:  'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500',
}

export default function ConsecrationMatrix({
  currentDay,
  completedDayNumbers,
  totalCompleted,
}: ConsecrationMatrixProps) {
  const days = Array.from({ length: 40 }, (_, i) => i + 1)
  const completedSet = new Set(completedDayNumbers)

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
            40-Day Consecration Matrix
          </h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            Visual journey from Day 1 to Day 40
          </p>
        </div>
        <div className="flex flex-col items-center bg-green-50 dark:bg-green-950/40 rounded-xl px-3 py-1.5 border border-green-200/50 dark:border-green-800/40">
          <span className="text-lg font-black text-green-700 dark:text-green-400 leading-none">
            {totalCompleted}
          </span>
          <span className="text-[10px] text-green-700 dark:text-green-400 font-bold">Done</span>
        </div>
      </div>

      {/* Grid: 7 columns, 6 rows (days 1–40, last row has 5) */}
      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {days.map((day) => {
          const status = getDayStatus(day, currentDay, completedSet)
          return (
            <div
              key={day}
              title={`Day ${day} — ${status}`}
              className={`
                aspect-square rounded-lg flex items-center justify-center
                text-[11px] font-bold transition-all
                ${statusStyles[status]}
              `}
            >
              {status === 'completed' ? (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                day
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
        {[
          { color: 'bg-green-500', label: 'Completed' },
          { color: 'bg-amber-500', label: 'Current' },
          { color: 'bg-gray-200 dark:bg-zinc-700', label: 'Upcoming' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
