import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import AvatarUploader from '@/components/profile/AvatarUploader'
import type { Profile, MemberStats } from '@/lib/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, statsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase.rpc('get_member_stats', { member_id: user.id }),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/login')

  const stats: MemberStats = (statsRes.data as MemberStats[] | null)?.[0] ?? {
    current_streak: 0,
    longest_run: 0,
    total_completed: 0,
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BBCCLogo size="sm" />
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-zinc-100">
              Member Profile
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400">
              BBCC 40-Day Challenge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Identity & Avatar Upload Card */}
      <section className="px-4 mt-2">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800 transition-colors text-center">
          {/* Avatar Uploader Component */}
          <AvatarUploader
            userId={profile.id}
            currentAvatarUrl={profile.avatar_url}
            userName={profile.full_name}
          />

          <div className="mt-3">
            <div className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1 border border-green-200/50 dark:border-green-800/40">
              ✓ Active Disciple · Cohort 2025
            </div>
            <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">
              {profile.full_name}
            </h2>
            {profile.fellowship_unit && (
              <p className="text-xs text-gray-600 dark:text-zinc-400 font-medium flex items-center justify-center gap-1 mt-0.5">
                <span>🏛️</span> {profile.fellowship_unit}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              {profile.email}
            </p>
            {profile.phone && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                📞 {profile.phone}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 mt-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              value: stats.current_streak,
              label: 'Current\nStreak',
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40',
            },
            {
              value: stats.longest_run,
              label: 'Longest\nRun',
              color: 'text-orange-600 dark:text-orange-400',
              bg: 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-900/40',
            },
            {
              value: `${stats.total_completed}/40`,
              label: 'Disciplines',
              color: 'text-green-600 dark:text-green-400',
              bg: 'bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-900/40',
            },
          ].map(({ value, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <p className={`text-xl font-black ${color} leading-none`}>
                {value}
              </p>
              <p className="text-[9px] text-gray-500 dark:text-zinc-400 mt-1 leading-tight whitespace-pre-line font-medium">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Fellowship unit card */}
      {profile.fellowship_unit && (
        <section className="px-4 mt-3">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 transition-colors">
            <h3 className="text-xs font-black text-gray-500 dark:text-zinc-400 uppercase tracking-widest mb-2.5">
              Fellowship &amp; Ministry Unit
            </h3>
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏛️</span>
                <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                  {profile.fellowship_unit}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sign out */}
      <section className="px-4 mt-4">
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 border border-red-100 dark:border-red-900/30 text-center">
          <LogoutButton />
        </div>
      </section>
    </div>
  )
}
