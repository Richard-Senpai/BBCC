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
  completed: 'bg-green-500 text-white',
  current:   'bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-1',
  missed:    'bg-gray-100 text-gray-400',
  upcoming:  'bg-gray-100 text-gray-400',
}

export default function ConsecrationMatrix({
  currentDay,
  completedDayNumbers,
  totalCompleted,
  compact = false,
}: ConsecrationMatrixProps) {
  const days = Array.from({ length: 40 }, (_, i) => i + 1)
  const completedSet = new Set(completedDayNumbers)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">
            40-Day Consecration Matrix
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Visual journey from Day 1 to Day 40
          </p>
        </div>
        <div className="flex flex-col items-center bg-green-50 rounded-xl px-3 py-1.5">
          <span className="text-lg font-black text-green-600 leading-none">
            {totalCompleted}
          </span>
          <span className="text-[10px] text-green-600 font-medium">Done</span>
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
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
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
      <div className="flex items-center justify-center gap-4 mt-3">
        {[
          { color: 'bg-green-500', label: 'Completed' },
          { color: 'bg-amber-500', label: 'Current' },
          { color: 'bg-gray-200', label: 'Upcoming' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-[10px] text-gray-500 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
