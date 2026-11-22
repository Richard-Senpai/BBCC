'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Flame,
  BookOpen,
  Calendar,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  Trophy,
  ArrowRight,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Loader2,
  UserPlus,
} from 'lucide-react'
import AppTopBar from '@/components/AppTopBar'
import { setSessionChallenge, requestChallengeEnrollment, type HubChallengeItem, type HubDataResponse } from '@/lib/actions/challenges'
import { startMemberCourse } from '@/lib/actions/courses'
import type { Profile, HubCourseItem } from '@/lib/types'

type FilterType = 'all' | 'my' | 'available' | 'completed'

interface ChallengesViewProps {
  profile: Profile
  hubData: HubDataResponse
  courses?: HubCourseItem[]
  unreadCount?: number
}

interface UnifiedItem {
  id: string
  type: 'daily' | 'course'
  title: string
  description: string | null
  createdAt: string | null
  isNew: boolean
  isJoined: boolean
  sortRank: number // 1: In progress, 2: Available/New, 3: Upcoming, 4: Completed, 5: Expired

  // Card status
  state:
    | 'continue'
    | 'start'
    | 'request_to_join'
    | 'awaiting_approval'
    | 'not_enrolled'
    | 'upcoming'
    | 'completed'
    | 'access_ended'

  // Metadata
  durationDays?: number
  currentDay?: number
  totalLessons?: number
  lessonsCompleted?: number
  progressPct?: number
  daysUntilExpiry?: number | null
  startDateStr?: string
  countdownText?: string
  enrollmentMode: 'open' | 'approval'
  canAccess: boolean
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
    return `Starts in ${minutes}m`
  } catch {
    return 'Coming soon'
  }
}

export default function ChallengesView({
  profile,
  hubData,
  courses = [],
  unreadCount = 0,
}: ChallengesViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = (searchParams?.get('filter') as FilterType) || 'all'
  const [filter, setFilter] = useState<FilterType>(
    ['all', 'my', 'available', 'completed'].includes(initialFilter)
      ? initialFilter
      : 'all'
  )

  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [enrollmentStatusMap, setEnrollmentStatusMap] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000

  // 1. Unify daily challenges and courses into standardized items
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const list: UnifiedItem[] = []

    // A. Daily Challenges
    const allDaily = [
      ...(hubData.activeChallenge ? [hubData.activeChallenge] : []),
      ...hubData.upcomingChallenges,
      ...hubData.completedChallenges,
    ]

    for (const d of allDaily) {
      const isCreatedRecently =
        d.created_at && now.getTime() - new Date(d.created_at).getTime() < fourteenDaysMs
      const isEnrolled =
        d.user_enrollment_status === 'approved' ||
        (d.enrollment_mode === 'open' && (d.participated || d.user_completed_days > 0))
      const isNew = Boolean(isCreatedRecently && !isEnrolled)

      let state: UnifiedItem['state'] = 'start'
      let sortRank = 2

      const effectiveEnrollment = enrollmentStatusMap[d.id] ?? d.user_enrollment_status

      if (d.status === 'completed') {
        state = 'completed'
        sortRank = 4
      } else if (d.status === 'upcoming') {
        if (effectiveEnrollment === 'pending') {
          state = 'awaiting_approval'
          sortRank = 3
        } else if (effectiveEnrollment === 'rejected') {
          state = 'not_enrolled'
          sortRank = 3
        } else if (d.enrollment_mode === 'approval' && effectiveEnrollment !== 'approved') {
          state = 'request_to_join'
          sortRank = 3
        } else {
          state = 'upcoming'
          sortRank = 3
        }
      } else if (d.status === 'active') {
        if (effectiveEnrollment === 'pending') {
          state = 'awaiting_approval'
          sortRank = 2
        } else if (effectiveEnrollment === 'rejected') {
          state = 'not_enrolled'
          sortRank = 2
        } else if (d.enrollment_mode === 'approval' && effectiveEnrollment !== 'approved') {
          state = 'request_to_join'
          sortRank = 2
        } else if (d.can_access) {
          state = 'continue'
          sortRank = 1
        }
      }

      list.push({
        id: d.id,
        type: 'daily',
        title: d.name,
        description: d.description || null,
        createdAt: d.created_at || null,
        isNew,
        isJoined: isEnrolled,
        sortRank,
        state,
        durationDays: d.duration_days,
        currentDay: d.current_day,
        progressPct: d.progress_pct,
        startDateStr: d.start_date,
        countdownText: d.status === 'upcoming' ? calculateCountdown(d.start_date, d.timezone) : undefined,
        enrollmentMode: d.enrollment_mode,
        canAccess: d.can_access,
      })
    }

    // B. Self-Paced Courses
    for (const c of courses) {
      const isCreatedRecently =
        c.created_at && now.getTime() - new Date(c.created_at).getTime() < fourteenDaysMs
      const isJoined = c.is_started || c.user_enrollment_status === 'approved'
      const isNew = Boolean(isCreatedRecently && !isJoined)

      const effectiveEnrollment = enrollmentStatusMap[c.id] ?? c.user_enrollment_status

      let state: UnifiedItem['state'] = 'start'
      let sortRank = 2

      if (c.completed_at) {
        state = 'completed'
        sortRank = 4
      } else if (c.is_access_expired) {
        state = 'access_ended'
        sortRank = 5
      } else if (effectiveEnrollment === 'pending') {
        state = 'awaiting_approval'
        sortRank = 2
      } else if (effectiveEnrollment === 'rejected') {
        state = 'not_enrolled'
        sortRank = 2
      } else if (c.enrollment_mode === 'approval' && effectiveEnrollment !== 'approved') {
        state = 'request_to_join'
        sortRank = 2
      } else if (c.is_started) {
        state = 'continue'
        sortRank = 1
      } else {
        state = 'start'
        sortRank = 2
      }

      list.push({
        id: c.id,
        type: 'course',
        title: c.name,
        description: c.description,
        createdAt: c.created_at || null,
        isNew,
        isJoined,
        sortRank,
        state,
        totalLessons: c.total_lessons,
        lessonsCompleted: c.lessons_completed,
        progressPct: c.progress_pct,
        daysUntilExpiry: c.days_until_expiry,
        enrollmentMode: c.enrollment_mode,
        canAccess: c.can_access,
      })
    }

    return list
  }, [hubData, courses, now, fourteenDaysMs, enrollmentStatusMap])

  // 2. Filter & Sort Items
  const filteredItems = useMemo(() => {
    let result = unifiedItems

    if (filter === 'my') {
      result = unifiedItems.filter(
        (item) =>
          item.state === 'continue' ||
          item.state === 'completed' ||
          item.isJoined
      )
    } else if (filter === 'available') {
      result = unifiedItems.filter(
        (item) =>
          item.state === 'start' ||
          item.state === 'request_to_join' ||
          item.state === 'upcoming' ||
          item.isNew
      )
    } else if (filter === 'completed') {
      result = unifiedItems.filter((item) => item.state === 'completed')
    }

    // Sort order:
    // 1: In progress, 2: Available/New, 3: Upcoming, 4: Completed, 5: Expired
    return [...result].sort((a, b) => {
      if (a.sortRank !== b.sortRank) {
        return a.sortRank - b.sortRank
      }
      return a.title.localeCompare(b.title)
    })
  }, [unifiedItems, filter])

  // 3. Actions
  async function handleOpenDailyChallenge(challengeId: string) {
    try {
      await setSessionChallenge(challengeId)
    } catch {
      document.cookie = `bbcc_selected_challenge_id=${challengeId}; path=/; max-age=2592000; SameSite=Lax`
    }
    router.push(`/dashboard?challenge=${challengeId}`)
  }

  async function handleStartCourse(courseId: string) {
    setStartingId(courseId)
    setErrorMessage(null)
    const res = await startMemberCourse(courseId)
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to start course.')
      setStartingId(null)
      return
    }
    router.push(`/courses/${courseId}`)
  }

  async function handleRequestEnrollment(challengeId: string) {
    setRequestingId(challengeId)
    setErrorMessage(null)
    const res = await requestChallengeEnrollment(challengeId)
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to submit enrollment request.')
    } else {
      setEnrollmentStatusMap((prev) => ({ ...prev, [challengeId]: 'pending' }))
      router.refresh()
    }
    setRequestingId(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
      <div className="max-w-md mx-auto pb-24">
        {/* Top App Bar */}
        <AppTopBar
          profile={profile}
          title="Challenges & Courses"
          unreadAnnouncementsCount={unreadCount}
        />

        {/* Filter Chips Bar */}
        <div className="px-4 pt-3 pb-2 sticky top-[61px] z-30 bg-[var(--bg-canvas)]/90 backdrop-blur-md transition-colors border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Challenges' },
                { id: 'available', label: 'Available' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((chip) => {
              const active = filter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer select-none ${
                    active
                      ? 'bg-[var(--flame-accent)] text-white shadow-xs'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-ink)] border border-[var(--border-hairline)]'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Inline error notice if any */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="font-bold text-sm leading-none p-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Challenge & Course Cards List */}
        <div className="px-4 pt-3 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="my-10 text-center py-10 px-4 bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-hairline)]">
              <BookOpen size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
              <h3 className="text-sm font-semibold text-[var(--text-ink)]">
                No challenges found
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs mx-auto">
                {filter === 'completed'
                  ? 'You have not completed any challenges or courses yet.'
                  : filter === 'my'
                  ? 'You have not joined any challenges or courses yet.'
                  : 'Check back soon for upcoming consecrations and courses.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isDaily = item.type === 'daily'
              const isCourse = item.type === 'course'
              const isRequesting = requestingId === item.id
              const isStarting = startingId === item.id

              const isExpiringSoon =
                item.daysUntilExpiry !== null &&
                item.daysUntilExpiry !== undefined &&
                item.daysUntilExpiry <= 7

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 shadow-xs transition-colors hover:border-[var(--border-subtle)]"
                >
                  {/* Card Header: Type Badge + "New" Badge + Expiry / Countdown */}
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isDaily
                            ? 'bg-[var(--flame-subtle)] text-[var(--flame-accent)]'
                            : 'bg-[var(--course-subtle)] text-[var(--course-accent)]'
                        }`}
                      >
                        {isDaily ? (
                          <>
                            <Flame size={11} strokeWidth={2.2} />
                            <span>Daily Challenge</span>
                          </>
                        ) : (
                          <>
                            <BookOpen size={11} strokeWidth={2} />
                            <span>Course</span>
                          </>
                        )}
                      </span>

                      {item.isNew && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Secondary Status info */}
                    {item.countdownText && (
                      <span className="text-[11px] font-semibold text-[var(--flame-accent)] flex items-center gap-1">
                        <Clock size={11} />
                        <span>{item.countdownText}</span>
                      </span>
                    )}

                    {isExpiringSoon && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <Clock size={10} />
                        <span>
                          {item.daysUntilExpiry === 0
                            ? 'Ends today'
                            : `Ends in ${item.daysUntilExpiry}d`}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-[var(--text-ink)] font-serif leading-snug">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Progress Indicator for In-Progress Items */}
                  {item.state === 'continue' && item.progressPct !== undefined && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium mb-1">
                        <span>
                          {isDaily
                            ? `Day ${item.currentDay} of ${item.durationDays}`
                            : `${item.lessonsCompleted} of ${item.totalLessons} lessons completed`}
                        </span>
                        <span className="font-semibold text-[var(--text-ink)]">
                          {item.progressPct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isDaily ? 'bg-[var(--flame-accent)]' : 'bg-[var(--course-accent)]'
                          }`}
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3 text-xs">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      {isDaily
                        ? `${item.durationDays} Days Duration`
                        : `${item.totalLessons || 0} Lessons · Self-paced`}
                    </span>

                    {/* Action Button depending on state */}
                    {item.state === 'continue' && (
                      <button
                        type="button"
                        onClick={() =>
                          isDaily
                            ? handleOpenDailyChallenge(item.id)
                            : router.push(`/courses/${item.id}`)
                        }
                        className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold text-white shadow-2xs transition active:scale-[0.99] cursor-pointer ${
                          isDaily
                            ? 'bg-[var(--flame-accent)] hover:opacity-95'
                            : 'bg-[var(--course-accent)] hover:opacity-95'
                        }`}
                      >
                        <span>Continue</span>
                        <ArrowRight size={13} />
                      </button>
                    )}

                    {item.state === 'start' && (
                      <button
                        type="button"
                        disabled={isStarting}
                        onClick={() =>
                          isDaily
                            ? handleOpenDailyChallenge(item.id)
                            : handleStartCourse(item.id)
                        }
                        className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold text-white shadow-2xs transition active:scale-[0.99] cursor-pointer ${
                          isDaily
                            ? 'bg-[var(--flame-accent)] hover:opacity-95'
                            : 'bg-[var(--course-accent)] hover:opacity-95'
                        }`}
                      >
                        {isStarting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Starting...</span>
                          </>
                        ) : (
                          <>
                            <span>Start</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    )}

                    {item.state === 'request_to_join' && (
                      <button
                        type="button"
                        disabled={isRequesting}
                        onClick={() => handleRequestEnrollment(item.id)}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white shadow-2xs transition active:scale-[0.99] cursor-pointer"
                      >
                        {isRequesting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={13} />
                            <span>Request to Join</span>
                          </>
                        )}
                      </button>
                    )}

                    {item.state === 'awaiting_approval' && (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
                        <Clock size={12} />
                        <span>Awaiting Approval</span>
                      </span>
                    )}

                    {item.state === 'not_enrolled' && (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20">
                        <Lock size={12} />
                        <span>Not Enrolled</span>
                      </span>
                    )}

                    {item.state === 'upcoming' && (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold text-[var(--flame-accent)] bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/20">
                        <Calendar size={12} />
                        <span>Locked Until Start</span>
                      </span>
                    )}

                    {item.state === 'completed' && (
                      <button
                        type="button"
                        onClick={() =>
                          isDaily
                            ? handleOpenDailyChallenge(item.id)
                            : router.push(`/courses/${item.id}`)
                        }
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-[var(--text-ink)] bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-hairline)] transition active:scale-[0.99] cursor-pointer"
                      >
                        <RotateCcw size={12} />
                        <span>Revisit</span>
                      </button>
                    )}

                    {item.state === 'access_ended' && (
                      <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
                        <Lock size={12} />
                        <span>Access Ended</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
