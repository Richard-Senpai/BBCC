import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMemberHubData } from '@/lib/actions/challenges'
import { getMemberCoursesHubData } from '@/lib/actions/courses'
import ChallengesView from '@/components/challenges/ChallengesView'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ChallengesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch current user profile
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Profile | null; error: unknown }

  if (!profile) {
    redirect('/login')
  }

  // Pending or rejected members must wait at holding page
  if (profile.role !== 'admin' && (profile.status === 'pending' || profile.status === 'rejected')) {
    redirect('/pending')
  }

  // Calculate unread announcements count
  let unreadCount = 0
  if (profile.last_seen_announcements_at) {
    const { count } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', profile.last_seen_announcements_at)
    unreadCount = count ?? 0
  } else {
    const { count } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
    unreadCount = count ?? 0
  }

  // Fetch challenges and courses concurrently
  const [hubData, courses] = await Promise.all([
    getMemberHubData(),
    getMemberCoursesHubData(),
  ])

  return (
    <ChallengesView
      profile={profile}
      hubData={hubData}
      courses={courses}
      unreadCount={unreadCount}
    />
  )
}
