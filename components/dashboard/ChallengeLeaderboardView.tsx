'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flame, Crown, Shield, Award, Lock, AlertTriangle } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import type { LeaderboardEntry, Profile, MemberStats } from '@/lib/types'

interface ChallengeLeaderboardViewProps {
  challengeTitle: string
  durationDays: number
  currentDay: number
  isCompletedChallenge: boolean
  leaderboardRaw: any
  leaderboardError?: string | null
  userProfile: Profile
  userStats: MemberStats
  userActivitiesCount: number
}

export default function ChallengeLeaderboardView({
  challengeTitle,
  durationDays,
  currentDay,
  isCompletedChallenge,
  leaderboardRaw,
  leaderboardError,
  userProfile,
  userStats,
  userActivitiesCount,
}: ChallengeLeaderboardViewProps) {
  const [fellowshipFilter, setFellowshipFilter] = useState<'all' | 'units'>('all')

  let members: LeaderboardEntry[] = []
  let totalRankedMembers = 0
  let myRank: number | null = null
  let myTotalActivities = 0

  if (leaderboardRaw) {
    if (Array.isArray(leaderboardRaw)) {
      members = leaderboardRaw.map((entry: any) => {
        const userId = entry.user_id || entry.id || ''
        const totalActs = entry.total_activities_completed ?? entry.total_completed ?? 0
        return {
          ...entry,
          user_id: userId,
          id: userId,
          total_activities_completed: totalActs,
          total_completed: totalActs,
        }
      })
      totalRankedMembers = leaderboardRaw[0]?.total_ranked_members ?? members.length
      myRank = leaderboardRaw[0]?.my_rank != null ? Number(leaderboardRaw[0]?.my_rank) : null
      myTotalActivities = Number(leaderboardRaw[0]?.my_total_activities ?? 0)
    } else if (typeof leaderboardRaw === 'object') {
      const rawList = leaderboardRaw.members || leaderboardRaw.top_members || []
      members = (rawList as any[]).map((entry: any) => {
        const userId = entry.user_id || entry.id || ''
        const totalActs = entry.total_activities_completed ?? entry.total_completed ?? 0
        return {
          ...entry,
          user_id: userId,
          id: userId,
          total_activities_completed: totalActs,
          total_completed: totalActs,
        }
      })
      totalRankedMembers = Number(leaderboardRaw.total_ranked_members ?? members.length)
      myRank = leaderboardRaw.my_rank != null ? Number(leaderboardRaw.my_rank) : null
      myTotalActivities = Number(leaderboardRaw.my_total_activities ?? 0)
    }
  }

  // Filter if unit selected
  const displayedMembers =
    fellowshipFilter === 'units' && userProfile.fellowship_unit
      ? members.filter((m) => m.fellowship_unit === userProfile.fellowship_unit)
      : members

  const topMembers = displayedMembers.slice(0, 6)
  const isInsideTop6 = topMembers.some((m) => m.user_id === userProfile.id)
  const effectiveUserRank = myRank ?? (topMembers.find((m) => m.user_id === userProfile.id)?.rank ?? null)
  const userRankDisplay = effectiveUserRank
    ? `${effectiveUserRank}`
    : userActivitiesCount > 0
    ? totalRankedMembers > 0
      ? `>${totalRankedMembers}`
      : '-'
    : '-'

  const top1 = topMembers[0] ?? null
  const top2 = topMembers[1] ?? null
  const top3 = topMembers[2] ?? null
  const ranks4To6 = topMembers.slice(3, 6)
  const currentWeek = currentDay > 0 ? Math.ceil(currentDay / 7) : 1

  return (
    <div className="space-y-4 pt-3 pb-8">
      {/* ── Challenge Status Banner ────────────────────────────── */}
      <section className="px-4">
        {isCompletedChallenge ? (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-[11px] font-semibold mb-1">
                  <Lock size={13} strokeWidth={2} />
                  Final Fellowship Standings — Frozen Archive
                </span>
                <h2 className="text-sm font-semibold text-[var(--text-ink)]">
                  {challengeTitle}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  This consecration cycle has concluded. Fellowship honor podium and standings are sealed.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {totalRankedMembers}
                </span>
                <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                  Consecrated Disciples
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 transition-colors shadow-2xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 text-[var(--flame-accent)] text-[11px] font-semibold mb-1">
                  <Flame size={13} strokeWidth={1.75} />
                  Week {currentWeek} Corporate Milestone
                </span>
                <h2 className="text-sm font-bold text-[var(--text-ink)] font-serif">
                  Corporate Fast &amp; Prayer
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Daily discipleship and fellowship covenant.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-[var(--flame-accent)] leading-none">
                  {totalRankedMembers > 0 ? totalRankedMembers : 1}
                </span>
                <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                  Disciples Ranked
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Filter Pills ──────────────────────────────────────── */}
      <section className="px-4">
        <div className="flex bg-[var(--bg-subtle)] rounded-xl p-1 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => setFellowshipFilter('all')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
              fellowshipFilter === 'all'
                ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs'
                : 'hover:text-[var(--text-ink)]'
            }`}
          >
            All Church
          </button>
          <button
            type="button"
            onClick={() => setFellowshipFilter('units')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
              fellowshipFilter === 'units'
                ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs'
                : 'hover:text-[var(--text-ink)]'
            }`}
          >
            {userProfile.fellowship_unit || 'My Fellowship Unit'}
          </button>
        </div>
      </section>

      {/* ── Error Banner ──────────────────────────────────────── */}
      {leaderboardError && (
        <section className="px-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-600 dark:text-red-400">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle size={15} /> Unable to Load Fellowship Standings
            </p>
            <p className="mt-1 opacity-90 leading-relaxed">{leaderboardError}</p>
          </div>
        </section>
      )}

      {/* ── The Spiritual Podium ──────────────────────────────── */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            Fellowship Honor Podium
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--flame-accent)] bg-[var(--flame-subtle)] px-2 py-0.5 rounded-full border border-[var(--flame-accent)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)]" />
            Top Watch
          </span>
        </div>

        {/* Rank #1 Crown Card */}
        {top1 ? (
          <div
            className={`bg-[var(--bg-surface)] rounded-2xl p-4 border relative overflow-hidden transition-all shadow-2xs ${
              top1.user_id === userProfile.id
                ? 'border-[var(--flame-accent)] ring-2 ring-[var(--flame-accent)]/25'
                : 'border-[var(--flame-accent)]/30'
            }`}
          >
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
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--flame-accent)]">
                    <Crown size={12} strokeWidth={2} />
                    First Watch Crown
                  </span>
                  {top1.user_id === userProfile.id && (
                    <span className="text-[9px] bg-[var(--flame-accent)] text-white font-bold px-1.5 py-0.2 rounded">
                      You
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-[var(--text-ink)] text-sm truncate font-serif">
                    {top1.full_name}
                  </h3>
                  {top1.display_tag && (
                    <span className="text-[9px] font-semibold text-[var(--covenant-accent)] bg-[var(--covenant-subtle)] px-1.5 py-0.5 rounded border border-[var(--covenant-accent)]/20">
                      {top1.display_tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {top1.fellowship_unit || 'General Assembly'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-hairline)]">
              <span className="text-xs text-[var(--covenant-accent)] font-semibold">
                {top1.total_activities_completed} Activities Done
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--flame-accent)]">
                <Flame size={13} strokeWidth={2} />
                {top1.current_streak}d Streak
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)]">
            <p className="text-sm font-semibold text-[var(--text-ink)] mb-1">
              No disciples ranked yet
            </p>
            <p className="text-xs">
              Complete your daily consecration disciplines to claim the First Watch Crown!
            </p>
          </div>
        )}

        {/* Rank #2 and #3 */}
        {top1 && top2 && top3 && (
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {/* Rank 2 */}
            <div
              className={`bg-[var(--bg-surface)] rounded-2xl p-3 border relative transition-all shadow-2xs ${
                top2.user_id === userProfile.id
                  ? 'border-[var(--flame-accent)] ring-1 ring-[var(--flame-accent)]/25'
                  : 'border-[var(--border-hairline)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <UserAvatar avatarUrl={top2.avatar_url} name={top2.full_name} size="sm" />
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                  #2
                </span>
              </div>
              <h4 className="font-bold text-[var(--text-ink)] text-xs truncate font-serif">
                {top2.full_name}
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                {top2.fellowship_unit || 'General Assembly'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--covenant-accent)]">
                  {top2.total_activities_completed} Done
                </span>
                <span className="font-semibold text-[var(--flame-accent)] flex items-center gap-0.5">
                  <Flame size={11} strokeWidth={2} />
                  {top2.current_streak}d
                </span>
              </div>
            </div>

            {/* Rank 3 */}
            <div
              className={`bg-[var(--bg-surface)] rounded-2xl p-3 border relative transition-all shadow-2xs ${
                top3.user_id === userProfile.id
                  ? 'border-[var(--flame-accent)] ring-1 ring-[var(--flame-accent)]/25'
                  : 'border-[var(--border-hairline)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <UserAvatar avatarUrl={top3.avatar_url} name={top3.full_name} size="sm" />
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                  #3
                </span>
              </div>
              <h4 className="font-bold text-[var(--text-ink)] text-xs truncate font-serif">
                {top3.full_name}
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                {top3.fellowship_unit || 'General Assembly'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--covenant-accent)]">
                  {top3.total_activities_completed} Done
                </span>
                <span className="font-semibold text-[var(--flame-accent)] flex items-center gap-0.5">
                  <Flame size={11} strokeWidth={2} />
                  {top3.current_streak}d
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Ranks 4 to 6 List ──────────────────────────────────── */}
      {ranks4To6.length > 0 && (
        <section className="px-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
              Fellowship Standings
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              Ranks #4 – #{Math.min(6, displayedMembers.length)}
            </span>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden shadow-2xs">
            {ranks4To6.map((member) => {
              const isCurrentUser = member.user_id === userProfile.id
              return (
                <div
                  key={member.user_id}
                  className={`p-3 flex items-center justify-between transition ${
                    isCurrentUser
                      ? 'bg-[var(--flame-subtle)] border-l-4 border-l-[var(--flame-accent)]'
                      : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-bold ${
                        isCurrentUser ? 'text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      #{member.rank}
                    </span>
                    <UserAvatar avatarUrl={member.avatar_url} name={member.full_name} size="sm" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={`font-semibold text-xs ${
                            isCurrentUser ? 'text-[var(--flame-accent)]' : 'text-[var(--text-ink)]'
                          }`}
                        >
                          {member.full_name}
                        </p>
                        {isCurrentUser && (
                          <span className="text-[9px] bg-[var(--flame-accent)] text-white font-bold px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--covenant-accent)]">
                          {member.total_activities_completed}
                        </span>{' '}
                        Done
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--border-hairline)]">
                    <Flame size={12} strokeWidth={2} />
                    {member.current_streak}d
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Current User Standing Card ────────────────────────── */}
      <section className="px-4">
        <div className="bg-[var(--bg-surface)] text-[var(--text-ink)] rounded-2xl p-4 border border-[var(--border-hairline)] shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserAvatar avatarUrl={userProfile.avatar_url} name={userProfile.full_name} size="md" />
              <div>
                <p className="font-bold text-sm text-[var(--text-ink)] font-serif">
                  {userProfile.full_name}
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Active Consecration Pilgrim
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-bold text-[var(--flame-accent)] leading-none">
                #{userRankDisplay}
              </span>
              <p className="text-[10px] text-[var(--text-muted)]">My Rank</p>
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] rounded-xl p-2.5 mt-3 flex items-center justify-between text-xs text-[var(--text-muted)] border border-[var(--border-hairline)]">
            <span className="font-semibold text-[var(--covenant-accent)]">
              {userActivitiesCount} Activities Completed
            </span>
            <span className="flex items-center gap-1 font-semibold text-[var(--flame-accent)]">
              <Flame size={13} strokeWidth={2} />
              {userStats.current_streak}-Day Streak
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
