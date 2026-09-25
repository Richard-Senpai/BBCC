import Link from 'next/link'
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

  // Parallel fetches: current day, top leaderboard (up to 10), and current user metrics
  const [currentDayRes, leaderboardRes, userProfileRes, userStatsRes] =
    await Promise.all([
      supabase.rpc('get_current_challenge_day'),
      supabase.rpc('get_leaderboard', { limit_count: 10 }),
      user
        ? supabase.from('profiles').select('*').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
      user
        ? supabase.rpc('get_member_stats', { member_id: user.id })
        : Promise.resolve({ data: null }),
    ])

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
        <div className="flex items-center gap-2">
          <BBCCLogo size="sm" />
          <div className="leading-tight">
            <h1 className="text-sm font-black text-gray-900 dark:text-zinc-100">
              Fellowship Standings
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Day {currentDay > 0 ? currentDay : 1} of 40 · Corporate Consecration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-300 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
          >
            🔔
          </button>
        </div>
      </header>

      {/* ── Corporate Milestone Banner ────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-amber-200/60 dark:border-zinc-800 mt-2 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1 border border-amber-200/50 dark:border-amber-900/40">
              🔥 Week {currentWeek} Milestones
            </span>
            <h2 className="text-sm font-black text-gray-900 dark:text-zinc-100">
              Corporate Fast &amp; Prayer
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Daily discipleship and watchman covenant.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
              94%
            </span>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">
              Church Activity
            </p>
          </div>
        </div>
      </section>

      {/* ── Filter Pills ──────────────────────────────────────── */}
      <section className="flex bg-gray-200/70 dark:bg-zinc-800/80 rounded-xl p-1 mt-3 text-xs font-semibold text-gray-600 dark:text-zinc-300">
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 font-bold shadow-sm transition"
        >
          All Church
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition"
        >
          Bible Units
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition"
        >
          Youth
        </button>
      </section>

      {/* ── The Spiritual Podium ──────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-zinc-100">
            The Spiritual Podium
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Live Rankings
          </span>
        </div>

        {/* Rank #1 Crown Card */}
        {top1 ? (
          <div className="bg-gradient-to-b from-amber-50/80 to-white dark:from-zinc-800/90 dark:to-zinc-900 rounded-2xl p-4 border-2 border-amber-300 dark:border-amber-500/60 shadow-sm relative overflow-hidden transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <UserAvatar
                  avatarUrl={top1.avatar_url}
                  name={top1.full_name}
                  size="lg"
                  className="ring-2 ring-amber-400"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow">
                  1
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full mb-0.5">
                  👑 First Watch Crown
                </span>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm truncate">
                  {top1.full_name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                  {top1.fellowship_unit || 'General Assembly'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-100 dark:border-zinc-800">
              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
                🔥 {top1.current_streak} {top1.current_streak === 1 ? 'Day' : 'Days'} Streak
              </span>
              <span className="text-xs font-bold text-green-700 dark:text-green-400">
                {top1.total_completed}/40 Disciplines Done
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 text-center text-gray-400 dark:text-zinc-500 border border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-sm">No members ranked yet. Start your streak today!</p>
          </div>
        )}

        {/* Rank #2 and #3 Side-by-Side */}
        {(top2 || top3) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Rank 2 */}
            {top2 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 border border-gray-200/80 dark:border-zinc-800 shadow-sm relative transition-colors">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                  #2
                </span>
                <div className="mb-2">
                  <UserAvatar
                    avatarUrl={top2.avatar_url}
                    name={top2.full_name}
                    size="md"
                  />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-xs truncate">
                  {top2.full_name}
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                  {top2.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    🔥 {top2.current_streak}d
                  </span>
                  <span className="text-gray-500 dark:text-zinc-400 font-medium">
                    {top2.total_completed} Done
                  </span>
                </div>
              </div>
            ) : null}

            {/* Rank 3 */}
            {top3 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 border border-gray-200/80 dark:border-zinc-800 shadow-sm relative transition-colors">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                  #3
                </span>
                <div className="mb-2">
                  <UserAvatar
                    avatarUrl={top3.avatar_url}
                    name={top3.full_name}
                    size="md"
                  />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-xs truncate">
                  {top3.full_name}
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                  {top3.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    🔥 {top3.current_streak}d
                  </span>
                  <span className="text-gray-500 dark:text-zinc-400 font-medium">
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
          <div className="bg-gray-950 dark:bg-zinc-900 text-white rounded-2xl p-4 shadow-md border border-gray-800 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  avatarUrl={userProfile.avatar_url}
                  name={userProfile.full_name}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-white">
                      {userProfile.full_name}
                    </p>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      You
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">
                    Top 5% in BBCC
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-lg font-black text-amber-400 leading-none">
                  #{userRank ?? '-'}
                </span>
                <p className="text-[10px] text-gray-400">Rank</p>
              </div>
            </div>

            <div className="bg-gray-800/80 dark:bg-zinc-800/60 rounded-xl p-2.5 mt-3 flex items-center justify-between text-xs text-gray-300">
              <span className="flex items-center gap-1 font-bold text-amber-400">
                🔥 {userStats.current_streak}-Day Streak
              </span>
              <span>{userStats.total_completed} of 40 Tasks Completed</span>
            </div>

            <Link
              href="/dashboard"
              className="mt-3 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
            >
              Complete Today&apos;s Prayer ➔
            </Link>
          </div>
        </section>
      )}

      {/* ── Consecration Seals ────────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100">
              Consecration Seals
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Faith milestones unlocked through obedience
            </p>
          </div>
          <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full border border-green-200/50 dark:border-green-800/40">
            {userStats.total_completed >= 14 ? '2 / 4' : userStats.total_completed >= 7 ? '1 / 4' : '0 / 4'} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {/* 7-Day */}
          <div
            className={`rounded-2xl p-3 border transition ${
              userStats.total_completed >= 7
                ? 'bg-green-50/70 dark:bg-green-950/30 border-green-300 dark:border-green-800/60'
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🛡️</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  userStats.total_completed >= 7
                    ? 'bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                }`}
              >
                {userStats.total_completed >= 7 ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 mt-2">
              7-Day Foundation
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
              Consecrated Altar Built
            </p>
          </div>

          {/* 14-Day */}
          <div
            className={`rounded-2xl p-3 border transition ${
              userStats.total_completed >= 14
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🔥</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  userStats.total_completed >= 14
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                }`}
              >
                {userStats.total_completed >= 14 ? 'Active' : 'Locked'}
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 mt-2">
              14-Day Fire Seal
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
              Deep Prayer Mantle
            </p>
          </div>

          {/* 21-Day */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-200 dark:border-zinc-800 opacity-80">
            <div className="flex items-center justify-between">
              <span className="text-lg">🔒</span>
              <span className="text-[10px] font-bold bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
                In 7 Days
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 mt-2">
              21-Day Consecration
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
              Daniel Fast Milestone
            </p>
          </div>

          {/* 40-Day */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-200 dark:border-zinc-800 opacity-80">
            <div className="flex items-center justify-between">
              <span className="text-lg">🎖️</span>
              <span className="text-[10px] font-bold bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
                Final Crown
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 mt-2">
              40-Day Overcomer
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
              Full Corporate Measure
            </p>
          </div>
        </div>
      </section>

      {/* ── Fellowship Roll of Honor ──────────────────────────── */}
      {runnersUp.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100">
              Fellowship Roll of Honor
            </h3>
            <span className="text-xs text-gray-400 dark:text-zinc-500">Ranks #4 – #10</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden transition-colors">
            {runnersUp.map((member) => (
              <div
                key={member.id}
                className="p-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-gray-400 dark:text-zinc-500">
                    {member.rank}
                  </span>
                  <UserAvatar
                    avatarUrl={member.avatar_url}
                    name={member.full_name}
                    size="sm"
                  />
                  <div>
                    <p className="font-bold text-xs text-gray-900 dark:text-zinc-100">
                      {member.full_name}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                      {member.fellowship_unit || 'General Assembly'} · {member.total_completed} Tasks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                    🔥 {member.current_streak}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Scripture Exhortation ─────────────────────────────── */}
      <section className="mt-5 mb-3">
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-2xl p-3.5 border-y border-r border-amber-200/60 dark:border-amber-900/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
            📖 Hebrews 10:24
          </span>
          <p className="text-xs text-gray-700 dark:text-zinc-300 italic mt-1 leading-relaxed">
            &ldquo;And let us consider how we may spur one another on toward love
            and good deeds.&rdquo;
          </p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-1">
            BBCC Corporate Consecration Covenant 2025
          </p>
        </div>
      </section>
    </div>
  )
}
