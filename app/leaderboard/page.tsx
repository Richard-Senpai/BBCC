import Link from 'next/link'
import { Bell, Flame, Crown, Shield, Award, BookOpen, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import UserAvatar from '@/components/UserAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import type { LeaderboardEntry, Profile, MemberStats } from '@/lib/types'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Parallel fetches: current day, settings, top leaderboard (up to 10), and current user metrics
  const [currentDayRes, settingsRes, leaderboardRes, userProfileRes, userStatsRes] =
    await Promise.all([
      supabase.rpc('get_current_challenge_day'),
      supabase.from('challenge_settings').select('*').eq('id', 1).single(),
      supabase.rpc('get_leaderboard', { limit_count: 10 }),
      user
        ? supabase.from('profiles').select('*').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
      user
        ? supabase.rpc('get_member_stats', { member_id: user.id })
        : Promise.resolve({ data: null }),
    ])

  const settings = settingsRes.data
  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'
  const currentDay = (currentDayRes.data as number) ?? 0
  const leaderboard: LeaderboardEntry[] = (leaderboardRes.data as LeaderboardEntry[] | null) ?? []
  const userProfile = userProfileRes.data as Profile | null
  const userStats = (userStatsRes.data as MemberStats[] | null)?.[0] ?? {
    current_streak: 0,
    longest_run: 0,
    total_completed: 0,
  }

  // Find user's rank in leaderboard or calculate
  const userRankEntry = userProfile
    ? leaderboard.find((entry) => entry.id === userProfile.id)
    : null
  const userRank = userRankEntry?.rank ?? (userStats.current_streak > 0 ? 4 : null)

  const top1 = leaderboard[0] ?? null
  const top2 = leaderboard[1] ?? null
  const top3 = leaderboard[2] ?? null
  const runnersUp = leaderboard.slice(3)

  const currentWeek = currentDay > 0 ? Math.ceil(currentDay / 7) : 1

  return (
    <div className="px-4 pt-5 pb-8">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <BBCCLogo size="sm" />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text-ink)]">
              Fellowship Standings
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--olive-accent)] inline-block" />
              Day {currentDay > 0 ? currentDay : 1} of {durationDays} / Corporate Consecration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-ink)] transition"
          >
            <Bell size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* ── Corporate Milestone Banner ────────────────────────── */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-4 mt-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 text-[var(--flame-accent)] text-[11px] font-semibold mb-1">
              <Flame size={13} strokeWidth={1.75} />
              Week {currentWeek} Corporate Milestone
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Corporate Fast &amp; Prayer
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Daily discipleship and fellowship covenant.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-[var(--flame-accent)] leading-none">
              94%
            </span>
            <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
              Congregation Active
            </p>
          </div>
        </div>
      </section>

      {/* ── Filter Pills ──────────────────────────────────────── */}
      <section className="flex bg-[var(--bg-subtle)] rounded-xl p-1 mt-3 text-xs font-medium text-[var(--text-muted)] border border-[var(--border-hairline)]">
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-ink)] font-semibold shadow-xs transition"
        >
          All Church
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] transition"
        >
          Bible Units
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] transition"
        >
          Youth
        </button>
      </section>

      {/* ── The Spiritual Podium ──────────────────────────────── */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider">
            Fellowship Honor Podium
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)]" />
            Live Rankings
          </span>
        </div>

        {/* Rank #1 Crown Card */}
        {top1 ? (
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--flame-accent)]/40 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="relative">
                <UserAvatar
                  avatarUrl={top1.avatar_url}
                  name={top1.full_name}
                  size="lg"
                  className="ring-2 ring-[var(--flame-accent)]/50"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--flame-accent)] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-surface)]">
                  1
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--flame-accent)] mb-0.5">
                  <Crown size={12} strokeWidth={1.75} />
                  First Watch Crown
                </span>
                <h3 className="font-semibold text-[var(--text-ink)] text-sm truncate">
                  {top1.full_name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {top1.fellowship_unit || 'General Assembly'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-hairline)]">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--flame-accent)]">
                <Flame size={13} strokeWidth={1.75} />
                {top1.current_streak} {top1.current_streak === 1 ? 'Day' : 'Days'} Streak
              </span>
              <span className="text-xs text-[var(--olive-accent)] font-medium">
                {top1.total_completed}/{durationDays} Disciplines
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)]">
            <p className="text-xs">No disciples ranked yet. Begin your streak today.</p>
          </div>
        )}

        {/* Rank #2 and #3 Side-by-Side */}
        {(top2 || top3) && (
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {/* Rank 2 */}
            {top2 ? (
              <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] relative">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                  #2
                </span>
                <div className="mb-2">
                  <UserAvatar
                    avatarUrl={top2.avatar_url}
                    name={top2.full_name}
                    size="md"
                  />
                </div>
                <h4 className="font-semibold text-[var(--text-ink)] text-xs truncate">
                  {top2.full_name}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {top2.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--flame-accent)] flex items-center gap-0.5">
                    <Flame size={11} strokeWidth={1.75} />
                    {top2.current_streak}d
                  </span>
                  <span className="text-[var(--text-muted)] font-normal">
                    {top2.total_completed} Done
                  </span>
                </div>
              </div>
            ) : null}

            {/* Rank 3 */}
            {top3 ? (
              <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] relative">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                  #3
                </span>
                <div className="mb-2">
                  <UserAvatar
                    avatarUrl={top3.avatar_url}
                    name={top3.full_name}
                    size="md"
                  />
                </div>
                <h4 className="font-semibold text-[var(--text-ink)] text-xs truncate">
                  {top3.full_name}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {top3.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--flame-accent)] flex items-center gap-0.5">
                    <Flame size={11} strokeWidth={1.75} />
                    {top3.current_streak}d
                  </span>
                  <span className="text-[var(--text-muted)] font-normal">
                    {top3.total_completed} Done
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Current User Standing Card ────────────────────────── */}
      {userProfile && (
        <section className="mt-4">
          <div className="bg-[var(--bg-surface)] text-[var(--text-ink)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  avatarUrl={userProfile.avatar_url}
                  name={userProfile.full_name}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-[var(--text-ink)]">
                      {userProfile.full_name}
                    </p>
                    <span className="text-[10px] bg-[var(--bg-subtle)] text-[var(--flame-accent)] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                      You
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Active Disciple in BBCC
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-lg font-bold text-[var(--flame-accent)] leading-none">
                  #{userRank ?? '-'}
                </span>
                <p className="text-[10px] text-[var(--text-muted)]">Rank</p>
              </div>
            </div>

            <div className="bg-[var(--bg-subtle)] rounded-lg p-2.5 mt-3 flex items-center justify-between text-xs text-[var(--text-muted)] border border-[var(--border-hairline)]">
              <span className="flex items-center gap-1 font-medium text-[var(--flame-accent)]">
                <Flame size={13} strokeWidth={1.75} />
                {userStats.current_streak}-Day Streak
              </span>
              <span>{userStats.total_completed} of {durationDays} Disciplines</span>
            </div>

            <Link
              href="/dashboard"
              className="mt-3 w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 text-white font-medium rounded-lg text-xs flex items-center justify-center transition"
            >
              Complete Today&apos;s Consecration
            </Link>
          </div>
        </section>
      )}

      {/* ── Consecration Seals ────────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider">
              Consecration Seals
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Faith milestones unlocked through obedience
            </p>
          </div>
          <span className="text-xs font-medium text-[var(--olive-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
            {userStats.total_completed >= 14 ? '2 / 4' : userStats.total_completed >= 7 ? '1 / 4' : '0 / 4'} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {/* 7-Day */}
          <div
            className={`rounded-xl p-3 border transition ${
              userStats.total_completed >= 7
                ? 'bg-[var(--bg-surface)] border-[var(--olive-accent)]/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] opacity-85'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={userStats.total_completed >= 7 ? 'text-[var(--olive-accent)]' : 'text-[var(--text-muted)]'}>
                <Shield size={16} strokeWidth={1.75} />
              </span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  userStats.total_completed >= 7
                    ? 'bg-[var(--bg-subtle)] text-[var(--olive-accent)] border border-[var(--olive-accent)]/30'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                }`}
              >
                {userStats.total_completed >= 7 ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <p className="font-semibold text-xs text-[var(--text-ink)] mt-2">
              7-Day Foundation
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Consecrated Altar Built
            </p>
          </div>

          {/* 14-Day */}
          <div
            className={`rounded-xl p-3 border transition ${
              userStats.total_completed >= 14
                ? 'bg-[var(--bg-surface)] border-[var(--flame-accent)]/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] opacity-85'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={userStats.total_completed >= 14 ? 'text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'}>
                <Flame size={16} strokeWidth={1.75} />
              </span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  userStats.total_completed >= 14
                    ? 'bg-[var(--bg-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/30'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                }`}
              >
                {userStats.total_completed >= 14 ? 'Active' : 'Locked'}
              </span>
            </div>
            <p className="font-semibold text-xs text-[var(--text-ink)] mt-2">
              14-Day Fire Seal
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Deep Prayer Mantle
            </p>
          </div>

          {/* 21-Day */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] opacity-75">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">
                <Lock size={16} strokeWidth={1.75} />
              </span>
              <span className="text-[10px] font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                In 7 Days
              </span>
            </div>
            <p className="font-semibold text-xs text-[var(--text-ink)] mt-2">
              21-Day Consecration
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Daniel Fast Milestone
            </p>
          </div>

          {/* Final Crown Seal */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] opacity-75">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">
                <Award size={16} strokeWidth={1.75} />
              </span>
              <span className="text-[10px] font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                {userStats.total_completed >= durationDays ? 'Completed' : 'Final Crown'}
              </span>
            </div>
            <p className="font-semibold text-xs text-[var(--text-ink)] mt-2">
              {durationDays}-Day {challengeName}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Full Corporate Measure
            </p>
          </div>
        </div>
      </section>

      {/* ── Fellowship Roll of Honor ──────────────────────────── */}
      {runnersUp.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider">
              Fellowship Roll of Honor
            </h3>
            <span className="text-xs text-[var(--text-muted)]">Ranks #4 – #10</span>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
            {runnersUp.map((member) => (
              <div
                key={member.id}
                className="p-3 flex items-center justify-between hover:bg-[var(--bg-subtle)] transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-semibold text-[var(--text-muted)]">
                    {member.rank}
                  </span>
                  <UserAvatar
                    avatarUrl={member.avatar_url}
                    name={member.full_name}
                    size="sm"
                  />
                  <div>
                    <p className="font-semibold text-xs text-[var(--text-ink)]">
                      {member.full_name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {member.fellowship_unit || 'General Assembly'} / {member.total_completed} Disciplines
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--border-hairline)]">
                    <Flame size={12} strokeWidth={1.75} />
                    {member.current_streak}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Scripture Exhortation ─────────────────────────────── */}
      <section className="mt-5 mb-3">
        <div className="bg-[var(--bg-surface)] border-l-2 border-[var(--flame-accent)] rounded-r-xl p-3.5 border-y border-r border-[var(--border-hairline)]">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--flame-accent)]">
            <BookOpen size={13} strokeWidth={1.75} />
            Hebrews 10:24
          </span>
          <p className="font-serif text-xs text-[var(--text-ink)] italic mt-1 leading-relaxed">
            &ldquo;And let us consider how we may spur one another on toward love
            and good deeds.&rdquo;
          </p>
          <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1">
            BBCC Corporate Consecration Covenant
          </p>
        </div>
      </section>
    </div>
  )
}
