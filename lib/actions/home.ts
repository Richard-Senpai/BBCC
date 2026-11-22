'use server'

import { createClient } from '@/lib/supabase/server'
import { getMemberHubData } from '@/lib/actions/challenges'
import { getMemberCoursesHubData } from '@/lib/actions/courses'
import type { Profile, HubCourseItem } from '@/lib/types'

export interface HomeHeroDaily {
  id: string
  name: string
  currentDay: number
  durationDays: number
  activitiesDone: number
  activitiesTotal: number
  streak: number
  rank: number | null
}

export interface HomeHeroCourse {
  id: string
  name: string
  nextLessonId: string | null
  nextLessonTitle: string | null
  nextLessonPosition: number | null
  lessonsCompleted: number
  totalLessons: number
  progressPct: number
}

export interface HomeHeroData {
  type: 'daily' | 'course' | 'none'
  dailyChallenge?: HomeHeroDaily
  course?: HomeHeroCourse
}

export interface HomeQuickStats {
  streak: number
  totalActivitiesCompleted: number
  completedCount: number
}

export interface HomePendingRequest {
  id: string
  title: string
  type: 'daily' | 'course'
}

export interface HomeCompletedItem {
  id: string
  title: string
  type: 'daily' | 'course'
  completedDate?: string | null
}

export interface HomeLatestAnnouncement {
  id: string
  title: string
  body: string
  created_at: string
}

export interface HomeData {
  profile: Profile
  unreadAnnouncementsCount: number
  heroData: HomeHeroData
  quickStats: HomeQuickStats
  inProgressCourses: HubCourseItem[]
  pendingRequests: HomePendingRequest[]
  completedItems: HomeCompletedItem[]
  totalCompletedCount: number
  latestAnnouncement: HomeLatestAnnouncement | null
  isBrandNewMember: boolean
}

export async function getHomeData(): Promise<HomeData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // 1. Fetch current profile
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Profile | null; error: unknown }

  if (!profile) return null

  // 2. Parallel data fetching with resilient defaults
  const [
    hubDataResult,
    coursesResult,
    totalActivitiesCountResult,
    announcementResult,
    unreadAnnouncementsCountResult,
  ] = await Promise.allSettled([
    getMemberHubData(),
    getMemberCoursesHubData(),
    supabase
      .from('activity_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    profile.last_seen_announcements_at
      ? supabase
          .from('announcements')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', profile.last_seen_announcements_at)
      : supabase
          .from('announcements')
          .select('*', { count: 'exact', head: true }),
  ])

  const hubData =
    hubDataResult.status === 'fulfilled'
      ? hubDataResult.value
      : {
          activeChallenge: null,
          upcomingChallenges: [],
          completedChallenges: [],
          betweenChallenges: true,
          nextUpcomingStartDate: null,
          nextUpcomingChallengeName: null,
        }

  const courses: HubCourseItem[] =
    coursesResult.status === 'fulfilled' ? coursesResult.value : []

  const totalActivitiesCompleted =
    totalActivitiesCountResult.status === 'fulfilled' &&
    totalActivitiesCountResult.value.count !== null
      ? totalActivitiesCountResult.value.count
      : 0

  const latestAnnouncement =
    announcementResult.status === 'fulfilled' && announcementResult.value.data
      ? (announcementResult.value.data as HomeLatestAnnouncement)
      : null

  const unreadAnnouncementsCount =
    unreadAnnouncementsCountResult.status === 'fulfilled' &&
    unreadAnnouncementsCountResult.value.count !== null
      ? unreadAnnouncementsCountResult.value.count
      : 0

  // 3. Resolve Hero Card
  // Priority 1: Active daily challenge where member is enrolled
  let heroData: HomeHeroData = { type: 'none' }
  const activeChallenge = hubData.activeChallenge

  if (activeChallenge && activeChallenge.can_access) {
    let activitiesDone = 0
    let activitiesTotal = 0

    try {
      const { data: dayRow } = await supabase
        .from('challenge_days')
        .select('id, activities(id)')
        .eq('challenge_id', activeChallenge.id)
        .eq('day_number', activeChallenge.current_day)
        .maybeSingle()

      if (dayRow && Array.isArray(dayRow.activities)) {
        activitiesTotal = dayRow.activities.length
        const actIds = dayRow.activities.map((a: { id: string }) => a.id)
        if (actIds.length > 0) {
          const { count } = await supabase
            .from('activity_completions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('activity_id', actIds)
          activitiesDone = count ?? 0
        }
      }
    } catch (err) {
      console.warn('[getHomeData] Error querying active day activities:', err)
    }

    heroData = {
      type: 'daily',
      dailyChallenge: {
        id: activeChallenge.id,
        name: activeChallenge.name,
        currentDay: activeChallenge.current_day,
        durationDays: activeChallenge.duration_days,
        activitiesDone,
        activitiesTotal,
        streak: activeChallenge.user_streak,
        rank: activeChallenge.user_rank,
      },
    }
  } else {
    // Priority 2: In-progress course
    const inProgressCourse = courses.find(
      (c) => c.is_started && !c.completed_at && !c.is_access_expired
    )

    if (inProgressCourse) {
      let nextLessonTitle: string | null = null
      let nextLessonPosition: number | null = null

      if (inProgressCourse.next_uncompleted_lesson_id) {
        try {
          const { data: lessonRow } = await supabase
            .from('course_lessons')
            .select('title, position')
            .eq('id', inProgressCourse.next_uncompleted_lesson_id)
            .maybeSingle()
          if (lessonRow) {
            nextLessonTitle = lessonRow.title
            nextLessonPosition = lessonRow.position
          }
        } catch (err) {
          console.warn('[getHomeData] Error querying next lesson details:', err)
        }
      }

      heroData = {
        type: 'course',
        course: {
          id: inProgressCourse.id,
          name: inProgressCourse.name,
          nextLessonId: inProgressCourse.next_uncompleted_lesson_id,
          nextLessonTitle,
          nextLessonPosition,
          lessonsCompleted: inProgressCourse.lessons_completed,
          totalLessons: inProgressCourse.total_lessons,
          progressPct: inProgressCourse.progress_pct,
        },
      }
    }
  }

  // 4. In-progress courses list
  const inProgressCourses = courses.filter(
    (c) => c.is_started && !c.completed_at && !c.is_access_expired
  )

  // 5. Awaiting approval list
  const pendingRequests: HomePendingRequest[] = []

  if (activeChallenge && activeChallenge.user_enrollment_status === 'pending') {
    pendingRequests.push({
      id: activeChallenge.id,
      title: activeChallenge.name,
      type: 'daily',
    })
  }

  for (const up of hubData.upcomingChallenges) {
    if (up.user_enrollment_status === 'pending') {
      pendingRequests.push({
        id: up.id,
        title: up.name,
        type: 'daily',
      })
    }
  }

  for (const c of courses) {
    if (c.user_enrollment_status === 'pending') {
      pendingRequests.push({
        id: c.id,
        title: c.name,
        type: 'course',
      })
    }
  }

  // 6. Completed items
  const completedDaily = hubData.completedChallenges
    .filter((c) => c.participated || c.user_completed_days > 0)
    .map((c) => ({
      id: c.id,
      title: c.name,
      type: 'daily' as const,
      completedDate: c.end_date,
    }))

  const completedCourses = courses
    .filter((c) => c.completed_at != null)
    .map((c) => ({
      id: c.id,
      title: c.name,
      type: 'course' as const,
      completedDate: c.completed_at,
    }))

  const allCompleted = [...completedDaily, ...completedCourses]
  const totalCompletedCount = allCompleted.length
  const completedItems = allCompleted.slice(0, 3)

  // 7. Quick Stats
  // Streak from active challenge or fallback
  const streak = activeChallenge?.user_streak ?? 0

  const quickStats: HomeQuickStats = {
    streak,
    totalActivitiesCompleted,
    completedCount: totalCompletedCount,
  }

  // 8. Brand-new member check
  const isBrandNewMember =
    totalActivitiesCompleted === 0 &&
    heroData.type === 'none' &&
    inProgressCourses.length === 0 &&
    totalCompletedCount === 0 &&
    pendingRequests.length === 0

  return {
    profile,
    unreadAnnouncementsCount,
    heroData,
    quickStats,
    inProgressCourses,
    pendingRequests,
    completedItems,
    totalCompletedCount,
    latestAnnouncement,
    isBrandNewMember,
  }
}
