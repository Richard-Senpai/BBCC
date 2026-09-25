import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
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
    <div className="px-4 pt-5">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <BBCCLogo size="sm" />
          <div className="leading-tight">
            <h1 className="text-sm font-black text-gray-900">
              Fellowship Standings
            </h1>
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Day {currentDay > 0 ? currentDay : 1} of 40 · Corporate Consecration
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm hover:bg-gray-50 transition"
        >
          🔔
        </button>
      </header>

      {/* ── Corporate Milestone Banner ────────────────────────── */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 mt-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
              🔥 Week {currentWeek} Milestones
            </span>
            <h2 className="text-sm font-black text-gray-900">
              Corporate Fast &amp; Prayer
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Daily discipleship and watchman covenant.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-600 leading-none">
              94%
            </span>
            <p className="text-[10px] text-gray-400 font-medium">
              Church Activity
            </p>
          </div>
        </div>
      </section>

      {/* ── Filter Pills ──────────────────────────────────────── */}
      <section className="flex bg-gray-200/70 rounded-xl p-1 mt-3 text-xs font-semibold text-gray-600">
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg bg-white text-gray-900 font-bold shadow-sm transition"
        >
          All Church
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 transition"
        >
          Bible Units
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 transition"
        >
          Youth
        </button>
      </section>

      {/* ── The Spiritual Podium ──────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-gray-900">
            The Spiritual Podium
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Live Rankings
          </span>
        </div>

        {/* Rank #1 Crown Card */}
        {top1 ? (
          <div className="bg-gradient-to-b from-amber-50/70 to-white rounded-2xl p-4 border-2 border-amber-300 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-2xl font-black text-amber-800 shadow-inner">
                  {top1.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow">
                  1
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full mb-0.5">
                  👑 First Watch Crown
                </span>
                <h3 className="font-bold text-gray-900 text-sm truncate">
                  {top1.full_name}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {top1.fellowship_unit || 'General Assembly'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-100/70">
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                🔥 {top1.current_streak} {top1.current_streak === 1 ? 'Day' : 'Days'} Streak
              </span>
              <span className="text-xs font-bold text-green-700">
                {top1.total_completed}/40 Disciplines Done
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-dashed border-gray-200">
            <p className="text-sm">No members ranked yet. Start your streak today!</p>
          </div>
        )}

        {/* Rank #2 and #3 Side-by-Side */}
        {(top2 || top3) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Rank 2 */}
            {top2 ? (
              <div className="bg-white rounded-2xl p-3.5 border border-gray-200/80 shadow-sm relative">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  #2
                </span>
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-800 text-sm mb-2">
                  {top2.full_name.charAt(0).toUpperCase()}
                </div>
                <h4 className="font-bold text-gray-900 text-xs truncate">
                  {top2.full_name}
                </h4>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                  {top2.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-600">
                    🔥 {top2.current_streak}d
                  </span>
                  <span className="text-gray-500 font-medium">
                    {top2.total_completed} Done
                  </span>
                </div>
              </div>
            ) : null}

            {/* Rank 3 */}
            {top3 ? (
              <div className="bg-white rounded-2xl p-3.5 border border-gray-200/80 shadow-sm relative">
                <span className="absolute top-2.5 right-2.5 text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  #3
                </span>
                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-800 text-sm mb-2">
                  {top3.full_name.charAt(0).toUpperCase()}
                </div>
                <h4 className="font-bold text-gray-900 text-xs truncate">
                  {top3.full_name}
                </h4>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                  {top3.fellowship_unit || 'General Assembly'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-600">
                    🔥 {top3.current_streak}d
                  </span>
                  <span className="text-gray-500 font-medium">
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
          <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-md border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-gray-950 font-black text-sm flex items-center justify-center">
                  {userProfile.full_name.charAt(0).toUpperCase()}
                </div>
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

            <div className="bg-gray-800/80 rounded-xl p-2.5 mt-3 flex items-center justify-between text-xs text-gray-300">
              <span className="flex items-center gap-1 font-bold text-amber-400">
                🔥 {userStats.current_streak}-Day Streak
              </span>
              <span>{userStats.total_completed} of 40 Tasks Completed</span>
            </div>

            <Link
              href="/dashboard"
              className="mt-3 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
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
            <h3 className="text-sm font-black text-gray-900">
              Consecration Seals
            </h3>
            <p className="text-xs text-gray-500">
              Faith milestones unlocked through obedience
            </p>
          </div>
          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {userStats.total_completed >= 14 ? '2 / 4' : userStats.total_completed >= 7 ? '1 / 4' : '0 / 4'} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {/* 7-Day */}
          <div
            className={`rounded-2xl p-3 border transition ${
              userStats.total_completed >= 7
                ? 'bg-green-50/60 border-green-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🛡️</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  userStats.total_completed >= 7
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {userStats.total_completed >= 7 ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 mt-2">
              7-Day Foundation
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Consecrated Altar Built
            </p>
          </div>

          {/* 14-Day */}
          <div
            className={`rounded-2xl p-3 border transition ${
              userStats.total_completed >= 14
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🔥</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  userStats.total_completed >= 14
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {userStats.total_completed >= 14 ? 'Active' : 'Locked'}
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 mt-2">
              14-Day Fire Seal
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Deep Prayer Mantle
            </p>
          </div>

          {/* 21-Day */}
          <div className="bg-white rounded-2xl p-3 border border-gray-200 opacity-80">
            <div className="flex items-center justify-between">
              <span className="text-lg">🔒</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                In 7 Days
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 mt-2">
              21-Day Consecration
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Daniel Fast Milestone
            </p>
          </div>

          {/* 40-Day */}
          <div className="bg-white rounded-2xl p-3 border border-gray-200 opacity-80">
            <div className="flex items-center justify-between">
              <span className="text-lg">🎖️</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                Final Crown
              </span>
            </div>
            <p className="font-bold text-xs text-gray-900 mt-2">
              40-Day Overcomer
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Full Corporate Measure
            </p>
          </div>
        </div>
      </section>

      {/* ── Fellowship Roll of Honor ──────────────────────────── */}
      {runnersUp.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black text-gray-900">
              Fellowship Roll of Honor
            </h3>
            <span className="text-xs text-gray-400">Ranks #4 – #10</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {runnersUp.map((member) => (
              <div
                key={member.id}
                className="p-3 flex items-center justify-between hover:bg-gray-50/50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-gray-400">
                    {member.rank}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-gray-900">
                      {member.full_name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {member.fellowship_unit || 'General Assembly'} · {member.total_completed} Tasks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
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
        <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-2xl p-3.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
            📖 Hebrews 10:24
          </span>
          <p className="text-xs text-gray-700 italic mt-1 leading-relaxed">
            &ldquo;And let us consider how we may spur one another on toward love
            and good deeds.&rdquo;
          </p>
          <p className="text-[10px] text-amber-700 font-semibold mt-1">
            BBCC Corporate Consecration Covenant 2025
          </p>
        </div>
      </section>
    </div>
  )
}
