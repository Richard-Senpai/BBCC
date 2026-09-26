import { redirect } from 'next/navigation'
import { Flame, TrendingUp, CheckCheck, Building2, Phone, Check } from 'lucide-react'
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

  const [profileRes, settingsRes, statsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('challenge_settings')
      .select('*')
      .eq('id', 1)
      .single(),
    supabase.rpc('get_member_stats', { member_id: user.id }),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/login')

  const settings = settingsRes.data
  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'

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
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text-ink)]">
              Member Profile
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {durationDays} Days of {challengeName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Identity & Avatar Upload Card */}
      <section className="px-4 mt-2">
        <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-hairline)] text-center shadow-xs">
          {/* Avatar Uploader Component */}
          <AvatarUploader
            userId={profile.id}
            currentAvatarUrl={profile.avatar_url}
            userName={profile.full_name}
          />

          <div className="mt-3">
            <div className="inline-flex items-center gap-1 bg-[var(--bg-subtle)] text-[var(--olive-accent)] text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 border border-[var(--border-hairline)]">
              <Check size={11} strokeWidth={2} />
              <span>Active Disciple</span>
            </div>
            <h2 className="text-base font-semibold text-[var(--text-ink)]">
              {profile.full_name}
            </h2>
            {profile.fellowship_unit && (
              <p className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-center gap-1.5 mt-0.5">
                <Building2 size={12} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                <span>{profile.fellowship_unit}</span>
              </p>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {profile.email}
            </p>
            {profile.phone && (
              <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1 mt-0.5">
                <Phone size={11} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                <span>{profile.phone}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 mt-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--flame-accent)] mb-1">
              <Flame size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.current_streak}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Current Streak
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--text-muted)] mb-1">
              <TrendingUp size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.longest_run}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Longest Run
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--olive-accent)] mb-1">
              <CheckCheck size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.total_completed}
              <span className="text-xs font-normal text-[var(--text-muted)]">/{durationDays}</span>
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Disciplines
            </p>
          </div>
        </div>
      </section>

      {/* Fellowship unit card */}
      {profile.fellowship_unit && (
        <section className="px-4 mt-3">
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs">
            <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Fellowship &amp; Ministry Unit
            </h3>
            <div className="flex items-center justify-between bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                <p className="text-xs font-semibold text-[var(--text-ink)]">
                  {profile.fellowship_unit}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sign out */}
      <section className="px-4 mt-4">
        <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] text-center">
          <LogoutButton />
        </div>
      </section>
    </div>
  )
}
