'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, RotateCcw, ChevronRight } from 'lucide-react'
import type { HomeCompletedItem } from '@/lib/actions/home'

interface HomeCompletedSectionProps {
  completedItems: HomeCompletedItem[]
  totalCompletedCount: number
}

export default function HomeCompletedSection({
  completedItems,
  totalCompletedCount,
}: HomeCompletedSectionProps) {
  if (completedItems.length === 0) return null

  return (
    <section className="px-4 mt-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-[var(--flame-accent)]" />
          <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            Completed Milestones
          </h3>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-full">
            {totalCompletedCount}
          </span>
        </div>

        {totalCompletedCount > 3 && (
          <Link
            href="/challenges?filter=completed"
            className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] flex items-center gap-0.5"
          >
            <span>See all ({totalCompletedCount})</span>
            <ChevronRight size={12} />
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {completedItems.map((item) => {
          const targetUrl =
            item.type === 'daily'
              ? `/dashboard?challenge=${item.id}`
              : `/courses/${item.id}`

          return (
            <div
              key={item.id}
              className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3.5 shadow-2xs transition-colors"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                      item.type === 'daily'
                        ? 'bg-[var(--flame-subtle)] text-[var(--flame-accent)]'
                        : 'bg-[var(--course-subtle)] text-[var(--course-accent)]'
                    }`}
                  >
                    {item.type === 'daily' ? 'Daily Challenge' : 'Course'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[var(--text-ink)] font-serif truncate">
                  {item.title}
                </h4>
              </div>

              <Link
                href={targetUrl}
                className="shrink-0 inline-flex items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-[var(--text-ink)] bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-hairline)] transition"
              >
                <RotateCcw size={12} />
                <span>Revisit</span>
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
