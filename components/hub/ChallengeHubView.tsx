'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Flame,
  Calendar,
  Clock,
  Lock,
  CheckCircle2,
  Trophy,
  ArrowRight,
  History,
  BookOpen,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Info,
  X,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import BBCCLogo from '@/components/BBCCLogo'
import AnnouncementBell from '@/components/AnnouncementBell'
import { setSessionChallenge, type HubChallengeItem, type HubDataResponse } from '@/lib/actions/challenges'
import type { Profile } from '@/lib/types'

interface ChallengeHubViewProps {
  profile: Profile
  hubData: HubDataResponse
  unreadCount?: number
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD'
  try {
    const d = new Date(dateStr + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateRange(startStr: string, durationDays: number): string {
  try {
    const s = new Date(startStr + 'T00:00:00Z')
    const e = new Date(s.getTime() + (durationDays - 1) * 86400000)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${s.toLocaleDateString('en-US', options)} – ${e.toLocaleDateString('en-US', options)}`
  } catch {
    return startStr
  }
}

function calculateCountdown(startDateStr: string, timezone = 'Africa/Lagos') {
  try {
    const now = new Date()
    const target = new Date(startDateStr + 'T00:00:00Z')
    const diffMs = target.getTime() - now.getTime()

    if (diffMs <= 0) return 'Commencing today'

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 1) return `Starts in ${days} days`
    if (days === 1) return `Starts tomorrow (${hours}h left)`
    if (hours > 0) return `Starts in ${hours}h ${minutes}m`
    return `Starts in ${minutes} minutes`
  } catch {
    return 'Coming soon'
  }
}

export default function ChallengeHubView({
  profile,
  hubData,
  unreadCount = 0,
}: ChallengeHubViewProps) {
  const router = useRouter()
  const [selectedUpcoming, setSelectedUpcoming] = useState<HubChallengeItem | null>(null)
  const [countdownText, setCountdownText] = useState<Record<string, string>>({})

  const {
    activeChallenge,
    upcomingChallenges,
    completedChallenges,
    betweenChallenges,
    nextUpcomingStartDate,
    nextUpcomingChallengeName,
  } = hubData

  // Update live countdown timers every minute
  useEffect(() => {
    function updateTimers() {
      const map: Record<string, string> = {}
      for (const up of upcomingChallenges) {
        map[up.id] = calculateCountdown(up.start_date, up.timezone)
      }
      setCountdownText(map)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 60000)
    return () => clearInterval(interval)
  }, [upcomingChallenges])

  async function handleOpenChallenge(challengeId: string) {
    try {
      await setSessionChallenge(challengeId)
    } catch {
      // Cookie set fallback
      document.cookie = `bbcc_selected_challenge_id=${challengeId}; path=/; max-age=2592000; SameSite=Lax`
    }
    router.push(`/dashboard?challenge=${challengeId}`)
  }

  const firstName = profile.full_name.split(' ')[0]

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] pb-24 transition-colors">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] sticky top-0 z-40 transition-colors">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BBCCLogo size="sm" />
            <div>
              <p className="text-xs font-bold text-[var(--text-ink)] leading-tight">
                BBCC Consecration Hub
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                Believers&apos; Banquet Christian Centre
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AnnouncementBell unreadCount={unreadCount} />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Member Greeting Banner */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-hairline)] shadow-xs transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <UserAvatar avatarUrl={profile.avatar_url} name={profile.full_name} size="lg" />
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--flame-accent)] uppercase tracking-wider bg-[var(--flame-subtle)] px-2 py-0.5 rounded-full border border-[var(--flame-accent)]/20 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)] inline-block" />
                  Pastoral Consecration Hub
                </span>
                <h1 className="text-lg font-bold text-[var(--text-ink)] tracking-tight font-serif">
                  Welcome in the Lord, {firstName}
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {profile.fellowship_unit || 'General Assembly'} · Ile-Ife Sanctuary
                </p>
              </div>
            </div>

            {profile.role === 'admin' && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 px-3 py-1.5 rounded-lg shadow-2xs transition"
              >
                <span>Admin Console</span>
              </Link>
            )}
          </div>
        </section>

        {/* ── SECTION 1: CURRENT / ACTIVE CHALLENGE ───────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <Flame size={14} className="text-[var(--flame-accent)]" />
              <span>Current Consecration Cycle</span>
            </h2>
            {activeChallenge && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Live &amp; Active
              </span>
            )}
          </div>

          {activeChallenge ? (
            /* Active Challenge Prominent Hero Card */
            <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border-2 border-[var(--flame-accent)]/40 shadow-xs relative overflow-hidden transition-colors">
              {/* Subtle decorative glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-[var(--flame-accent)]/10 to-transparent pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)] inline-block animate-pulse" />
                      Day {activeChallenge.current_day} of {activeChallenge.duration_days}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      · Concludes {formatDate(activeChallenge.end_date)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text-ink)] font-serif">
                      {activeChallenge.duration_days} Days of {activeChallenge.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      Corporate consecration, morning prayer watch, and daily scripture alignment for the BBCC family.
                    </p>
                  </div>

                  {/* Personal progress bar & streak pill */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        {activeChallenge.user_streak > 0 && (
                          <span className="inline-flex items-center gap-1 text-[var(--flame-accent)] font-bold bg-[var(--flame-subtle)] px-2 py-0.5 rounded-md border border-[var(--flame-accent)]/20">
                            <Flame size={12} strokeWidth={2.2} />
                            <span>{activeChallenge.user_streak}d Streak</span>
                          </span>
                        )}
                        <span className="text-[var(--text-muted)]">
                          {activeChallenge.user_completed_days} of {activeChallenge.duration_days} days completed
                        </span>
                      </div>
                      <span className="font-bold text-[var(--flame-accent)]">
                        {activeChallenge.progress_pct}%
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden border border-[var(--border-hairline)]">
                      <div
                        className="h-full rounded-full bg-[var(--flame-accent)] transition-all duration-500"
                        style={{ width: `${activeChallenge.progress_pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="self-start md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenChallenge(activeChallenge.id)}
                    className="w-full md:w-auto px-6 py-3.5 bg-[var(--flame-accent)] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <span>Continue Consecration</span>
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Friendly Between-Challenges State */
            <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-dashed border-[var(--border-subtle)] text-center transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] text-[var(--flame-accent)] mx-auto flex items-center justify-center mb-3 border border-[var(--border-hairline)]">
                <Sparkles size={20} strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-ink)] font-serif">
                {nextUpcomingStartDate
                  ? `Next Challenge Commences on ${formatDate(nextUpcomingStartDate)}`
                  : 'No Active Challenge Running Right Now'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1 leading-relaxed">
                {nextUpcomingStartDate && nextUpcomingChallengeName
                  ? `Pastoral leadership is preparing "${nextUpcomingChallengeName}". Until day one begins, you can revisit completed consecration archives below.`
                  : 'All church challenges have concluded. Revisit your past devotionals, scripture notes, and fellowship standings below.'}
              </p>
            </div>
          )}
        </section>

        {/* ── SECTION 2: UPCOMING CHALLENGES ─────────────────── */}
        {upcomingChallenges.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              <span>Upcoming Consecrations</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingChallenges.map((up) => {
                const countdown = countdownText[up.id] || calculateCountdown(up.start_date, up.timezone)

                return (
                  <div
                    key={up.id}
                    onClick={() => setSelectedUpcoming(up)}
                    className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-hairline)] hover:border-amber-500/40 shadow-xs transition-all cursor-pointer select-none flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Clock size={10} strokeWidth={2} />
                          <span>{countdown}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
                          <Lock size={10} strokeWidth={2} />
                          <span>Locked</span>
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-[var(--text-ink)] font-serif">
                        {up.duration_days} Days of {up.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={1.75} className="shrink-0" />
                        <span>Commences on {formatDate(up.start_date)} ({up.duration_days} Days)</span>
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Curriculum unlocks on Day 1
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <span>Details</span>
                        <ChevronRight size={12} strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── SECTION 3: COMPLETED CHALLENGE ARCHIVES ─────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[var(--olive-accent)]" />
              <span>Completed Consecration Archives</span>
            </h2>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {completedChallenges.length} Cycle{completedChallenges.length === 1 ? '' : 's'} Archived
            </span>
          </div>

          {completedChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {completedChallenges.map((c) => {
                return (
                  <div
                    key={c.id}
                    className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-hairline)] shadow-xs flex flex-col justify-between transition-colors"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--olive-accent)] bg-[var(--olive-accent)]/10 px-2.5 py-0.5 rounded-full border border-[var(--olive-accent)]/20">
                          <CheckCircle2 size={11} strokeWidth={2} />
                          <span>Completed Archive</span>
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] font-medium">
                          {c.duration_days} Days
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[var(--text-ink)] font-serif">
                        {c.duration_days} Days of {c.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={1.75} className="shrink-0" />
                        <span>{formatDateRange(c.start_date, c.duration_days)}</span>
                      </p>

                      {/* Member's Personal Archive Record */}
                      <div className="mt-4 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Your Personal Record
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)]">Activities Done</span>
                            <p className="font-bold text-[var(--text-ink)] mt-0.5">
                              {c.user_total_activities}{' '}
                              <span className="text-[10px] font-normal text-[var(--text-muted)]">Checked</span>
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)]">Full Days</span>
                            <p className="font-bold text-[var(--text-ink)] mt-0.5">
                              {c.user_completed_days} / {c.duration_days}
                            </p>
                          </div>
                        </div>

                        {c.participated && c.user_rank != null && (
                          <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                            <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                              <Trophy size={11} className="text-[var(--flame-accent)]" />
                              <span>Final Standings Rank</span>
                            </span>
                            <span className="font-bold text-[var(--flame-accent)]">
                              #{c.user_rank}
                            </span>
                          </div>
                        )}

                        {!c.participated && (
                          <p className="text-[11px] text-[var(--text-muted)] italic pt-1 border-t border-[var(--border-hairline)]">
                            View-only archive (you were not enrolled in this past cycle).
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Revisit Action Button */}
                    <div className="mt-4 pt-3 border-t border-[var(--border-hairline)]">
                      <button
                        type="button"
                        onClick={() => handleOpenChallenge(c.id)}
                        className="w-full py-2.5 px-4 bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] border border-[var(--border-hairline)] text-[var(--text-ink)] font-semibold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <History size={13} strokeWidth={2} className="text-[var(--flame-accent)]" />
                        <span>Revisit Archive</span>
                        <ArrowRight size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
              No previous challenges have concluded yet.
            </div>
          )}
        </section>
      </div>

      {/* ── UPCOMING CHALLENGE DETAILS MODAL ─────────────────── */}
      {selectedUpcoming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 transition-colors relative">
            <button
              type="button"
              onClick={() => setSelectedUpcoming(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-subtle)] transition cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[var(--border-hairline)]">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Lock size={18} strokeWidth={1.75} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Upcoming Consecration
                </span>
                <h3 className="text-base font-bold text-[var(--text-ink)] font-serif">
                  {selectedUpcoming.duration_days} Days of {selectedUpcoming.name}
                </h3>
              </div>
            </div>

            <div className="space-y-4 text-xs text-[var(--text-ink)] leading-relaxed">
              <div className="bg-[var(--bg-subtle)] p-3.5 rounded-xl border border-[var(--border-hairline)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Commencement Date</span>
                  <span className="font-semibold text-[var(--text-ink)]">
                    {formatDate(selectedUpcoming.start_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Countdown Status</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {calculateCountdown(selectedUpcoming.start_date, selectedUpcoming.timezone)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Total Duration</span>
                  <span className="font-semibold text-[var(--text-ink)]">
                    {selectedUpcoming.duration_days} Days
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--flame-subtle)]/50 border border-[var(--flame-accent)]/20 flex items-start gap-2.5">
                <Info size={15} className="text-[var(--flame-accent)] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[var(--text-muted)]">
                  Pastoral leaders are actively preparing devotional scriptures, prayer watches, and teachings. Daily disciplines and checklists will unlock on Day 1.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUpcoming(null)}
                  className="px-4 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] font-semibold text-xs rounded-xl border border-[var(--border-hairline)] transition cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
