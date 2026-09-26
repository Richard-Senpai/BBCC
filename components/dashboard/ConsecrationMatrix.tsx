import Link from 'next/link'
import { Check } from 'lucide-react'

interface ConsecrationMatrixProps {
  /** 1..durationDays: the active challenge day. null/0 if not started */
  currentDay: number | null
  /** Currently selected/viewed day on dashboard (for highlighting) */
  selectedDay?: number | null
  /** Set of day numbers the user has fully completed */
  completedDayNumbers: number[]
  totalCompleted: number
  /** Total days in challenge, default 40 */
  durationDays?: number
  /** Theme name, e.g. Overcomer */
  challengeName?: string
  /** Whether to show a compact version (dashboard) vs full (progress page) */
  compact?: boolean
  /** When previewing as a specific member */
  asMemberId?: string | null
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
  completed: 'bg-[var(--covenant-accent)] text-white',
  current:   'bg-[var(--flame-accent)] text-white ring-2 ring-[var(--flame-accent)]/30 font-bold',
  missed:    'bg-[var(--bg-subtle)] text-[var(--text-faint)] border border-[var(--border-subtle)]',
  upcoming:  'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]',
}

export default function ConsecrationMatrix({
  currentDay,
  selectedDay,
  completedDayNumbers,
  totalCompleted,
  durationDays = 40,
  challengeName = 'Overcomer',
  asMemberId,
}: ConsecrationMatrixProps) {
  const days = Array.from({ length: durationDays }, (_, i) => i + 1)
  const completedSet = new Set(completedDayNumbers)

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-bold text-[var(--text-ink)] text-sm tracking-tight">
            {durationDays}-Day Consecration Matrix
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Spiritual fidelity from Day 1 to Day {durationDays} · Tap past days to review
          </p>
        </div>
        <div className="flex flex-col items-center bg-[var(--covenant-subtle)] rounded-xl px-3 py-1.5 border border-[var(--covenant-accent)]/20">
          <span className="text-base font-bold text-[var(--covenant-accent)] leading-none">
            {totalCompleted}
          </span>
          <span className="text-[10px] text-[var(--covenant-accent)] font-medium">Done</span>
        </div>
      </div>

      {/* Grid: 7 columns */}
      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {days.map((day) => {
          const status = getDayStatus(day, currentDay, completedSet)
          const isAvailable = (currentDay !== null && day <= currentDay) || completedSet.has(day)
          const isSelected = selectedDay === day
          const linkHref = `/dashboard?day=${day}${asMemberId ? `&as_member=${asMemberId}` : ''}`

          const cellContent = (
            <div
              title={`Day ${day} — ${status}${isAvailable ? ' (Tap to view)' : ''}`}
              className={`
                aspect-square rounded-lg flex items-center justify-center
                text-[11px] font-medium transition-all
                ${statusStyles[status]}
                ${isSelected ? 'ring-2 ring-[var(--flame-accent)] ring-offset-2 ring-offset-[var(--bg-surface)] scale-105 z-10 font-bold shadow-xs' : ''}
                ${isAvailable ? 'hover:opacity-90 active:scale-95 cursor-pointer' : 'cursor-default'}
              `}
            >
              {status === 'completed' ? (
                <Check size={13} strokeWidth={2.5} className="text-white" />
              ) : (
                day
              )}
            </div>
          )

          if (isAvailable) {
            return (
              <Link key={day} href={linkHref} className="block outline-none">
                {cellContent}
              </Link>
            )
          }

          return (
            <div key={day} className="block">
              {cellContent}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
        {[
          { color: 'bg-[var(--covenant-accent)]', label: 'Completed' },
          { color: 'bg-[var(--flame-accent)]', label: 'Today' },
          { color: 'bg-[var(--bg-subtle)] border border-[var(--border-subtle)]', label: 'Upcoming' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-xs ${color}`} />
            <span className="text-[10px] text-[var(--text-muted)] font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
