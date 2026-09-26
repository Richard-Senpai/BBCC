import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CommunityChat from '@/components/community/CommunityChat'
import type { MessageWithSender, Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CommunityPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Parallel fetches for user profile, settings, current day number, and initial messages
  const [profileRes, settingsRes, currentDayRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('challenge_settings').select('*').eq('id', 1).single(),
    supabase.rpc('get_current_challenge_day'),
    supabase
      .from('messages')
      .select('id, user_id, content, created_at, profiles(id, full_name, avatar_url, fellowship_unit, role)')
      .order('created_at', { ascending: true })
      .limit(150),
  ])

  const profile = profileRes.data as Profile | null
  const settings = settingsRes.data
  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'
  const currentDay = (currentDayRes.data as number) ?? 0
  const initialMessages = (messagesRes.data as unknown as MessageWithSender[]) ?? []

  return (
    <CommunityChat
      initialMessages={initialMessages}
      currentUserId={user.id}
      isAdmin={profile?.role === 'admin'}
      currentUserProfile={profile}
      currentDay={currentDay}
      durationDays={durationDays}
      challengeName={challengeName}
    />
  )
}
