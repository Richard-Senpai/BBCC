'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  HubCourseItem,
  MemberCourseCardState,
  MemberLessonOutlineItem,
  CourseBlock,
  CourseAccessMode,
  EnrollmentMode,
} from '@/lib/types'

// Helper to determine expiry timestamp
function calculateCourseExpiry(
  course: {
    access_mode?: string | null
    access_end_date?: string | null
    access_days?: number | null
    timezone?: string | null
  },
  startedAt?: string | null,
  overrideUntil?: string | null
): { isExpired: boolean; expiryDate: string | null; daysUntilExpiry: number | null } {
  const now = new Date()

  // 1. Admin override always takes precedence
  if (overrideUntil) {
    const overrideDate = new Date(overrideUntil)
    const isExpired = now.getTime() > overrideDate.getTime()
    const diffMs = overrideDate.getTime() - now.getTime()
    const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return {
      isExpired,
      expiryDate: overrideDate.toISOString(),
      daysUntilExpiry: isExpired ? 0 : daysUntil,
    }
  }

  // 2. Unlimited
  if (!course.access_mode || course.access_mode === 'unlimited') {
    return { isExpired: false, expiryDate: null, daysUntilExpiry: null }
  }

  // 3. Fixed end date
  if (course.access_mode === 'fixed_end') {
    if (!course.access_end_date) {
      return { isExpired: false, expiryDate: null, daysUntilExpiry: null }
    }
    const tz = course.timezone || 'Africa/Lagos'
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
    const isExpired = todayStr > course.access_end_date
    const targetDate = new Date(course.access_end_date + 'T23:59:59Z')
    const diffMs = targetDate.getTime() - now.getTime()
    const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return {
      isExpired,
      expiryDate: course.access_end_date,
      daysUntilExpiry: isExpired ? 0 : daysUntil,
    }
  }

  // 4. Per member days
  if (course.access_mode === 'per_member_days') {
    if (!startedAt) {
      // Not yet started: valid to preview and start
      return { isExpired: false, expiryDate: null, daysUntilExpiry: null }
    }
    const days = course.access_days || 0
    if (days <= 0) {
      return { isExpired: false, expiryDate: null, daysUntilExpiry: null }
    }
    const startTime = new Date(startedAt).getTime()
    const expiryTime = startTime + days * 86400000
    const isExpired = now.getTime() >= expiryTime
    const diffMs = expiryTime - now.getTime()
    const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return {
      isExpired,
      expiryDate: new Date(expiryTime).toISOString(),
      daysUntilExpiry: isExpired ? 0 : daysUntil,
    }
  }

  return { isExpired: false, expiryDate: null, daysUntilExpiry: null }
}

/**
 * Fetch all published courses for the member Challenge Hub view.
 */
export async function getMemberCoursesHubData(): Promise<HubCourseItem[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch published courses
  const { data: courses, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('type', 'course')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error || !courses || courses.length === 0) {
    return []
  }

  const courseIds = courses.map((c) => c.id)

  // Fetch user enrollments, member state, lessons, completions concurrently
  const [enrollmentsRes, memberStateRes, lessonsRes, completionsRes] = await Promise.all([
    supabase
      .from('challenge_enrollments')
      .select('challenge_id, status')
      .eq('user_id', user.id)
      .in('challenge_id', courseIds),
    supabase
      .from('course_member_state')
      .select('challenge_id, started_at, completed_at, access_override_until')
      .eq('user_id', user.id)
      .in('challenge_id', courseIds),
    supabase
      .from('course_lessons')
      .select('id, challenge_id, position')
      .in('challenge_id', courseIds)
      .order('position', { ascending: true }),
    supabase
      .from('course_lesson_completions')
      .select('lesson_id')
      .eq('user_id', user.id),
  ])

  const enrollmentsMap = new Map((enrollmentsRes.data ?? []).map((e) => [e.challenge_id, e.status]))
  const stateMap = new Map((memberStateRes.data ?? []).map((s) => [s.challenge_id, s]))
  const completedLessonIds = new Set((completionsRes.data ?? []).map((c) => c.lesson_id))

  // Group lessons by challenge_id
  const lessonsByCourse = new Map<string, Array<{ id: string; position: number }>>()
  for (const l of lessonsRes.data ?? []) {
    const list = lessonsByCourse.get(l.challenge_id) || []
    list.push(l)
    lessonsByCourse.set(l.challenge_id, list)
  }

  const items: HubCourseItem[] = courses.map((course) => {
    const enrollStatusRaw = enrollmentsMap.get(course.id)
    const userEnrollmentStatus: 'none' | 'pending' | 'approved' | 'rejected' = enrollStatusRaw
      ? (enrollStatusRaw as 'pending' | 'approved' | 'rejected')
      : 'none'

    const mState = stateMap.get(course.id)
    const startedAt = mState?.started_at ?? null
    const completedAt = mState?.completed_at ?? null
    const overrideUntil = mState?.access_override_until ?? null

    const lessons = lessonsByCourse.get(course.id) || []
    const totalLessons = lessons.length
    const lessonsCompleted = lessons.filter((l) => completedLessonIds.has(l.id)).length
    const progressPct =
      totalLessons > 0 ? Math.min(100, Math.round((lessonsCompleted / totalLessons) * 100)) : 0

    // Find next uncompleted lesson
    const nextUncompleted = lessons.find((l) => !completedLessonIds.has(l.id))
    const nextLessonId = nextUncompleted ? nextUncompleted.id : lessons[0]?.id ?? null

    const enrollmentMode = (course.enrollment_mode as EnrollmentMode) || 'open'
    const isEnrolledApproved = enrollmentMode === 'open' || userEnrollmentStatus === 'approved'

    // Expiry calculation
    const { isExpired, expiryDate, daysUntilExpiry } = calculateCourseExpiry(
      course,
      startedAt,
      overrideUntil
    )

    // Admin always has access; members need enrollment approval + non-expired access
    const canAccess = isAdmin || (isEnrolledApproved && !isExpired)

    // Card state determination
    let cardState: MemberCourseCardState = 'start'
    if (canAccess) {
      if (completedAt || (lessonsCompleted === totalLessons && totalLessons > 0)) {
        cardState = 'completed'
      } else if (startedAt && lessonsCompleted > 0) {
        cardState = 'continue'
      } else {
        cardState = 'start'
      }
    } else {
      if (isExpired && (startedAt || isEnrolledApproved)) {
        cardState = 'access_ended'
      } else if (enrollmentMode === 'approval') {
        if (userEnrollmentStatus === 'pending') {
          cardState = 'awaiting_approval'
        } else if (userEnrollmentStatus === 'rejected') {
          cardState = 'rejected'
        } else {
          cardState = 'request_join'
        }
      } else if (isExpired) {
        cardState = 'access_ended'
      } else {
        cardState = 'request_join'
      }
    }

    return {
      id: course.id,
      name: course.name,
      description: course.description ?? null,
      enrollment_mode: enrollmentMode,
      access_mode: (course.access_mode as CourseAccessMode) || null,
      access_end_date: course.access_end_date ?? null,
      access_days: course.access_days ?? null,
      timezone: course.timezone || 'Africa/Lagos',
      is_published: Boolean(course.is_published),
      total_lessons: totalLessons,
      lessons_completed: lessonsCompleted,
      progress_pct: progressPct,
      is_started: Boolean(startedAt),
      started_at: startedAt,
      completed_at: completedAt,
      access_override_until: overrideUntil,
      is_access_expired: isExpired,
      access_expiry_date: expiryDate,
      days_until_expiry: daysUntilExpiry,
      user_enrollment_status: userEnrollmentStatus,
      can_access: canAccess,
      card_state: cardState,
      next_uncompleted_lesson_id: nextLessonId,
    }
  })

  return items
}

/**
 * Fetch course details and lesson outline for the member Course Outline view.
 */
export async function getCourseWithMemberOutline(
  courseId: string,
  previewMode = false
): Promise<{
  success: boolean
  status?: 'accessible' | 'unpublished' | 'expired' | 'not_enrolled'
  error?: string
  course?: any
  lessons?: MemberLessonOutlineItem[]
  isStarted?: boolean
  completedAt?: string | null
  startedAt?: string | null
  expiryDate?: string | null
  daysUntilExpiry?: number | null
  accessDescription?: string | null
  nextLessonId?: string | null
  isAdmin?: boolean
  isPreview?: boolean
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Fetch course
    const { data: course, error: cErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', courseId)
      .eq('type', 'course')
      .single()

    if (cErr || !course) {
      return { success: false, error: 'Course not found' }
    }

    // Handle Admin Preview Mode
    if (previewMode) {
      if (!isAdmin) {
        return { success: false, error: 'Unauthorized: Preview mode requires admin privileges' }
      }

      // In preview mode: fetch all lessons and mark them unlocked for previewing
      const { data: lessons } = await supabase
        .from('course_lessons')
        .select('*')
        .eq('challenge_id', courseId)
        .order('position', { ascending: true })

      const mappedLessons: MemberLessonOutlineItem[] = (lessons ?? []).map((l, index) => ({
        id: l.id,
        position: l.position,
        title: l.title,
        summary: l.summary,
        status: index === 0 ? 'current' : 'completed', // All accessible in preview
      }))

      return {
        success: true,
        status: 'accessible',
        course,
        lessons: mappedLessons,
        isStarted: true,
        completedAt: null,
        startedAt: null,
        expiryDate: null,
        daysUntilExpiry: null,
        accessDescription: 'Preview mode enabled (No progress recorded)',
        nextLessonId: mappedLessons[0]?.id ?? null,
        isAdmin: true,
        isPreview: true,
      }
    }

    // Non-preview check: is_published
    if (!course.is_published && !isAdmin) {
      return { success: true, status: 'unpublished', course }
    }

    // Check enrollment if approval mode
    if (course.enrollment_mode === 'approval' && !isAdmin) {
      const { data: enrollment } = await supabase
        .from('challenge_enrollments')
        .select('status')
        .eq('challenge_id', courseId)
        .eq('user_id', user.id)
        .single()

      if (!enrollment || enrollment.status !== 'approved') {
        return { success: true, status: 'not_enrolled', course }
      }
    }

    // Fetch member state
    const { data: memberState } = await supabase
      .from('course_member_state')
      .select('*')
      .eq('challenge_id', courseId)
      .eq('user_id', user.id)
      .single()

    const startedAt = memberState?.started_at ?? null
    const completedAt = memberState?.completed_at ?? null
    const overrideUntil = memberState?.access_override_until ?? null

    // Check expiry
    const { isExpired, expiryDate, daysUntilExpiry } = calculateCourseExpiry(
      course,
      startedAt,
      overrideUntil
    )

    if (isExpired && !isAdmin) {
      return {
        success: true,
        status: 'expired',
        course,
        expiryDate,
      }
    }

    // Access description wording
    let accessDescription: string | null = null
    if (overrideUntil) {
      const formatted = new Date(overrideUntil).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      accessDescription = `Access extended until ${formatted}`
    } else if (course.access_mode === 'fixed_end' && course.access_end_date) {
      const formatted = new Date(course.access_end_date + 'T00:00:00Z').toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      )
      accessDescription = `Access until ${formatted}`
    } else if (course.access_mode === 'per_member_days' && course.access_days) {
      if (startedAt && daysUntilExpiry !== null) {
        accessDescription = `You have ${course.access_days} days from when you started, ${daysUntilExpiry} left`
      } else {
        accessDescription = `You have ${course.access_days} days from when you start`
      }
    }

    // Fetch lessons
    const { data: rawLessons, error: lErr } = await supabase
      .from('course_lessons')
      .select('*')
      .eq('challenge_id', courseId)
      .order('position', { ascending: true })

    if (lErr) {
      return { success: false, error: lErr.message }
    }

    const lessons = rawLessons ?? []
    const lessonIds = lessons.map((l) => l.id)

    // Fetch user completed lessons
    const { data: completions } = await supabase
      .from('course_lesson_completions')
      .select('lesson_id')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds)

    const completedSet = new Set((completions ?? []).map((c) => c.lesson_id))

    // Determine status of each lesson sequentially
    let foundFirstIncomplete = false
    let nextLessonId: string | null = null

    const outline: MemberLessonOutlineItem[] = lessons.map((lesson) => {
      const isCompleted = completedSet.has(lesson.id)
      let status: 'completed' | 'current' | 'locked'

      if (isCompleted) {
        status = 'completed'
      } else if (!foundFirstIncomplete) {
        status = 'current'
        foundFirstIncomplete = true
        nextLessonId = lesson.id
      } else {
        status = 'locked'
      }

      return {
        id: lesson.id,
        position: lesson.position,
        title: lesson.title,
        summary: lesson.summary,
        status,
      }
    })

    if (!nextLessonId && outline.length > 0) {
      nextLessonId = outline[0].id
    }

    return {
      success: true,
      status: 'accessible',
      course,
      lessons: outline,
      isStarted: Boolean(startedAt),
      completedAt,
      startedAt,
      expiryDate,
      daysUntilExpiry,
      accessDescription,
      nextLessonId,
      isAdmin,
      isPreview: false,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load course outline',
    }
  }
}

/**
 * Fetch a specific lesson and its blocks for a member to view.
 */
export async function getLessonForMember(
  courseId: string,
  lessonId: string,
  previewMode = false
): Promise<{
  success: boolean
  status?: 'accessible' | 'unpublished' | 'expired' | 'locked'
  error?: string
  course?: any
  lesson?: {
    id: string
    challenge_id: string
    position: number
    title: string
    summary: string | null
  }
  blocks?: CourseBlock[]
  confirmedBlockIds?: string[]
  isCompleted?: boolean
  isLastLesson?: boolean
  previousLessonId?: string | null
  nextLessonId?: string | null
  totalLessons?: number
  currentLessonNumber?: number
  isAdmin?: boolean
  isPreview?: boolean
  expiryDate?: string | null
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Fetch course
    const { data: course, error: cErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', courseId)
      .eq('type', 'course')
      .single()

    if (cErr || !course) {
      return { success: false, error: 'Course not found' }
    }

    // Handle Admin Preview Mode
    if (previewMode) {
      if (!isAdmin) {
        return { success: false, error: 'Unauthorized: Preview mode requires admin privileges' }
      }

      const { data: allLessons } = await supabase
        .from('course_lessons')
        .select('id, challenge_id, position, title, summary')
        .eq('challenge_id', courseId)
        .order('position', { ascending: true })

      const lessonsList = allLessons ?? []
      const currentIndex = lessonsList.findIndex((l) => l.id === lessonId)
      const targetLesson = currentIndex >= 0 ? lessonsList[currentIndex] : lessonsList[0]

      if (!targetLesson) {
        return { success: false, error: 'Lesson not found' }
      }

      const { data: blocks } = await supabase
        .from('course_blocks')
        .select('*')
        .eq('lesson_id', targetLesson.id)
        .order('position', { ascending: true })

      const prevLesson = currentIndex > 0 ? lessonsList[currentIndex - 1] : null
      const nextLesson = currentIndex < lessonsList.length - 1 ? lessonsList[currentIndex + 1] : null

      return {
        success: true,
        status: 'accessible',
        course,
        lesson: targetLesson,
        blocks: (blocks ?? []) as CourseBlock[],
        confirmedBlockIds: [],
        isCompleted: false,
        isLastLesson: currentIndex === lessonsList.length - 1,
        previousLessonId: prevLesson?.id ?? null,
        nextLessonId: nextLesson?.id ?? null,
        totalLessons: lessonsList.length,
        currentLessonNumber: targetLesson.position,
        isAdmin: true,
        isPreview: true,
      }
    }

    // Check unpublished status
    if (!course.is_published && !isAdmin) {
      return { success: true, status: 'unpublished', course }
    }

    // Fetch member state & check expiry
    const { data: memberState } = await supabase
      .from('course_member_state')
      .select('*')
      .eq('challenge_id', courseId)
      .eq('user_id', user.id)
      .single()

    const { isExpired, expiryDate } = calculateCourseExpiry(
      course,
      memberState?.started_at ?? null,
      memberState?.access_override_until ?? null
    )

    if (isExpired && !isAdmin) {
      return { success: true, status: 'expired', course, expiryDate }
    }

    // Fetch all lessons to evaluate sequence and unlock state
    const { data: allLessons, error: lErr } = await supabase
      .from('course_lessons')
      .select('id, challenge_id, position, title, summary')
      .eq('challenge_id', courseId)
      .order('position', { ascending: true })

    if (lErr || !allLessons || allLessons.length === 0) {
      return { success: false, error: 'No lessons found in course' }
    }

    const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
    if (currentIndex < 0) {
      return { success: false, error: 'Lesson not found in this course' }
    }

    const currentLesson = allLessons[currentIndex]

    // Fetch user completions for this course
    const { data: completions } = await supabase
      .from('course_lesson_completions')
      .select('lesson_id')
      .eq('user_id', user.id)

    const completedLessonIds = new Set((completions ?? []).map((c) => c.lesson_id))

    // Check unlock state:
    // Unlocked if:
    // 1. Is admin
    // 2. Already completed
    // 3. First lesson (position 1 or index 0)
    // 4. Previous lesson is completed
    const isCompleted = completedLessonIds.has(currentLesson.id)
    const isFirstLesson = currentIndex === 0
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
    const isPrevCompleted = prevLesson ? completedLessonIds.has(prevLesson.id) : false

    const isUnlocked = isAdmin || isCompleted || isFirstLesson || isPrevCompleted

    if (!isUnlocked) {
      return {
        success: true,
        status: 'locked',
        course,
        lesson: currentLesson,
        totalLessons: allLessons.length,
        currentLessonNumber: currentLesson.position,
      }
    }

    // Fetch blocks for this lesson
    const { data: blocks, error: bErr } = await supabase
      .from('course_blocks')
      .select('*')
      .eq('lesson_id', currentLesson.id)
      .order('position', { ascending: true })

    if (bErr) {
      return { success: false, error: bErr.message }
    }

    // Fetch user confirmations for blocks in this lesson
    const blockIds = (blocks ?? []).map((b) => b.id)
    const { data: confirmations } = await supabase
      .from('course_block_confirmations')
      .select('block_id')
      .eq('user_id', user.id)
      .in('block_id', blockIds)

    const confirmedBlockIds = (confirmations ?? []).map((c) => c.block_id)

    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

    return {
      success: true,
      status: 'accessible',
      course,
      lesson: currentLesson,
      blocks: (blocks ?? []) as CourseBlock[],
      confirmedBlockIds,
      isCompleted,
      isLastLesson: currentIndex === allLessons.length - 1,
      previousLessonId: prevLesson?.id ?? null,
      nextLessonId: nextLesson?.id ?? null,
      totalLessons: allLessons.length,
      currentLessonNumber: currentLesson.position,
      isAdmin,
      isPreview: false,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load lesson',
    }
  }
}

/**
 * Start a course for the current member (calls start_course database RPC).
 */
export async function startMemberCourse(
  courseId: string,
  previewMode = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (previewMode) {
      return { success: true }
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('start_course', { target_challenge_id: courseId })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/courses/${courseId}`)
    revalidatePath('/hub')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start course',
    }
  }
}

/**
 * Confirm an interactive required action block (calls confirm_block database RPC).
 */
export async function confirmMemberBlock(
  blockId: string,
  previewMode = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (previewMode) {
      return { success: true }
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('confirm_block', { target_block_id: blockId })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to confirm block',
    }
  }
}

/**
 * Complete a lesson for the member (calls complete_lesson database RPC).
 */
export async function completeMemberLesson(
  lessonId: string,
  courseId: string,
  previewMode = false
): Promise<{ success: boolean; completedCourse?: boolean; error?: string }> {
  try {
    if (previewMode) {
      return { success: false, error: 'Completion is disabled in preview mode.' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('complete_lesson', { target_lesson_id: lessonId })

    if (error) {
      return { success: false, error: error.message }
    }

    const completedCourse = Boolean(data?.completed_course)

    revalidatePath(`/courses/${courseId}`)
    revalidatePath(`/courses/${courseId}/lessons/${lessonId}`)
    revalidatePath('/hub')

    return { success: true, completedCourse }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete lesson',
    }
  }
}
