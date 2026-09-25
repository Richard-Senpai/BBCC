import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import LogoutButton from '@/components/LogoutButton'
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
    <>
      <header className="px-4 pt-5 pb-3 flex items-center gap-3">
        <BBCCLogo size="sm" />
        <div>
          <h1 className="text-base font-black text-gray-900">Member Profile</h1>
          <p className="text-[10px] text-gray-500">BBCC 40-Day Challenge</p>
        </div>
      </header>

      {/* Identity card */}
      <section className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-black text-amber-600">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                ✓ Active Disciple · Cohort 2025
              </div>
              <p className="font-bold text-gray-900">{profile.full_name}</p>
              {profile.fellowship_unit && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <span>🏛️</span> {profile.fellowship_unit}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 mt-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: stats.current_streak, label: 'Current\nStreak', color: 'text-amber-600', bg: 'bg-amber-50' },
            { value: stats.longest_run,   label: 'Longest\nRun',     color: 'text-orange-600', bg: 'bg-orange-50' },
            { value: `${stats.total_completed}/40`, label: 'Disciplines', color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ value, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <p className={`text-xl font-black ${color} leading-none`}>{value}</p>
              <p className="text-[9px] text-gray-500 mt-1 leading-tight whitespace-pre-line">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fellowship unit */}
      {profile.fellowship_unit && (
        <section className="px-4 mt-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
              Fellowship &amp; Ministry Unit
            </h3>
            <div className="flex items-center justify-between bg-amber-50 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏛️</span>
                <p className="text-sm font-bold text-gray-800">
                  {profile.fellowship_unit}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sign out */}
      <section className="px-4 mt-4">
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
          <LogoutButton />
        </div>
      </section>
    </>
  )
}
