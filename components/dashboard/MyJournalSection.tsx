'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, Calendar, ChevronRight, PenLine } from 'lucide-react'
import { getUserJournalEntries } from '@/lib/actions/journal'
import type { JournalEntryWithDay } from '@/lib/types'

interface MyJournalSectionProps {
  initialEntries?: JournalEntryWithDay[]
}

export default function MyJournalSection({ initialEntries }: MyJournalSectionProps) {
  const [entries, setEntries] = useState<JournalEntryWithDay[]>(initialEntries ?? [])
  const [loading, setLoading] = useState<boolean>(!initialEntries)

  useEffect(() => {
    if (!initialEntries) {
      getUserJournalEntries().then((res) => {
        if (res.success && res.entries) {
          setEntries(res.entries)
        }
        setLoading(false)
      })
    }
  }, [initialEntries])

  return (
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-hairline)] shadow-xs transition-colors mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--flame-accent)]">
            <BookOpen size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              My Spiritual Journal &amp; Reflections
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Personal devotion notes, scripture revelations, and altar covenants.
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border-hairline)]">
          {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
        </span>
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            Loading your spiritual reflections…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-xl">
            <PenLine size={24} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--text-muted)] opacity-60" />
            <p className="text-xs font-semibold text-[var(--text-ink)]">
              No journal reflections recorded yet
            </p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto mt-1">
              Begin documenting what the Holy Spirit speaks to you each day on the dashboard checklist.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-[var(--flame-accent)] text-white text-xs font-medium hover:opacity-90 transition shadow-2xs"
            >
              <span>Go to Today&apos;s Devotion</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const day = entry.challenge_days
              const dayNum = day?.day_number ?? 1
              const updatedDate = new Date(entry.updated_at).toLocaleDateString('en-NG', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <Link
                  key={entry.id}
                  href={`/dashboard?day=${dayNum}`}
                  className="block p-3.5 rounded-xl border border-[var(--border-hairline)] hover:border-[var(--flame-accent)]/40 hover:bg-[var(--bg-subtle)] transition group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[var(--flame-accent)] bg-[var(--flame-subtle)] px-2 py-0.5 rounded-md border border-[var(--flame-accent)]/20">
                        Day {dayNum}
                      </span>
                      {day?.title && (
                        <span className="text-xs font-semibold text-[var(--text-ink)] group-hover:text-[var(--flame-accent)] transition truncate max-w-[200px] sm:max-w-xs">
                          {day.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] shrink-0">
                      <Calendar size={11} strokeWidth={1.75} />
                      <span>{updatedDate}</span>
                    </div>
                  </div>

                  {day?.scripture_reference && (
                    <p className="text-[11px] text-[var(--flame-accent)] font-serif italic mb-1.5">
                      {day.scripture_reference}
                    </p>
                  )}

                  <p className="text-xs text-[var(--text-ink)]/90 font-serif leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    &ldquo;{entry.content}&rdquo;
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--flame-accent)] font-medium">
                    <span className="group-hover:underline">Tap to open and edit</span>
                    <ChevronRight size={13} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
