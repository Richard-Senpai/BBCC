'use client'

import Link from 'next/link'
import { ArrowLeft, Layers, Flame } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'

interface ChallengeTabBarProps {
  currentTab: 'today' | 'progress' | 'leaderboard'
  challengeId?: string | null
  challengeTitle?: string
  currentDay?: number
  durationDays?: number
  streak?: number
}

export default function ChallengeTabBar({
  currentTab,
  challengeId,
  challengeTitle = 'BBCC Consecration',
  currentDay,
  durationDays,
  streak = 0,
}: ChallengeTabBarProps) {
  const challengeParam = challengeId ? `&challenge=${challengeId}` : ''
  const baseParam = challengeId ? `?challenge=${challengeId}` : ''

  const tabs = [
    {
      id: 'today',
      label: 'Today',
      href: challengeId ? `/dashboard?tab=today&challenge=${challengeId}` : '/dashboard?tab=today',
    },
    {
      id: 'progress',
      label: 'Progress',
      href: challengeId ? `/dashboard?tab=progress&challenge=${challengeId}` : '/dashboard?tab=progress',
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      href: challengeId ? `/dashboard?tab=leaderboard&challenge=${challengeId}` : '/dashboard?tab=leaderboard',
    },
  ] as const

  return (
    <div className="sticky top-0 z-40 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-hairline)] transition-colors">
      {/* ── Top Bar with Back Arrow to /challenges ─────────────── */}
      <div className="max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/challenges"
            title="Return to Challenges & Courses"
            aria-label="Back to Challenges"
            className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-ink)] transition shadow-2xs shrink-0 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="min-w-0 leading-tight">
            <h1 className="text-xs font-bold text-[var(--text-ink)] truncate tracking-tight font-serif">
              {challengeTitle}
            </h1>
            {currentDay !== undefined && durationDays !== undefined && (
              <p className="text-[10px] text-[var(--text-muted)] truncate">
                Day {currentDay > 0 ? currentDay : 1} of {durationDays} · Daily Consecration
              </p>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/challenges"
            title="Switch Challenge"
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)] px-2.5 py-1 rounded-full transition shadow-2xs"
          >
            <Layers size={11} className="text-[var(--flame-accent)]" />
            <span>Switch</span>
          </Link>

          {streak > 0 && (
            <div className="flex items-center gap-1 bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/25 text-[11px] font-bold px-2 py-0.5 rounded-full">
              <Flame size={12} strokeWidth={2.2} />
              <span>{streak}d</span>
            </div>
          )}

          <ThemeToggle />
        </div>
      </div>

      {/* ── Segmented Control Bar ─────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 pb-2.5">
        <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-hairline)] text-xs font-semibold">
          {tabs.map((tab) => {
            const active = currentTab === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer select-none ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--flame-accent)] font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
