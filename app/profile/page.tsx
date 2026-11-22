import { redirect } from 'next/navigation'
import { Building2, Phone, Calendar, ShieldCheck, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AppTopBar from '@/components/AppTopBar'
import AvatarUploader from '@/components/profile/AvatarUploader'
import AnnouncementsSection from '@/components/profile/AnnouncementsSection'
import NotificationSettingsSection from '@/components/profile/NotificationSettingsSection'
import AccountSettingsSection from '@/components/profile/AccountSettingsSection'
import MyJournalSection from '@/components/dashboard/MyJournalSection'
import ThemeToggle from '@/components/ThemeToggle'
import type { Profile, AnnouncementWithAuthor } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatMemberSince(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Consecration Pilgrim'
  try {
    const d = new Date(dateStr)
    return `Member since ${d.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })}`
  } catch {
    return 'Active Member'
  }
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profileRes, announcementsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('announcements')
      .select('id, title, body, created_by, created_at, profiles(full_name, avatar_url, role)')
      .order('created_at', { ascending: false }),
  ])

  const profile = profileRes.data as Profile | null
  if (!profile) {
    redirect('/login')
  }

  if (profile.role !== 'admin' && (profile.status === 'pending' || profile.status === 'rejected')) {
    redirect('/pending')
  }

  const announcements = (announcementsRes.data as unknown as AnnouncementWithAuthor[]) ?? []

  // Count unread announcements for the top bar bell
  let unreadCount = 0
  if (profile.last_seen_announcements_at) {
    const { count } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', profile.last_seen_announcements_at)
    unreadCount = count ?? 0
  } else {
    unreadCount = announcements.length
  }

  const memberSinceText = formatMemberSince(profile.created_at)

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
      <div className="max-w-md mx-auto pb-24">
        {/* Top App Bar */}
        <AppTopBar
          profile={profile}
          title="My Profile"
          unreadAnnouncementsCount={unreadCount}
        />

        {/* ── 1. Identity & Avatar Header Card ─────────────────── */}
        <section className="px-4 mt-3">
          <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-hairline)] text-center shadow-xs transition-colors">
            {/* Avatar with photo uploader */}
            <AvatarUploader
              userId={profile.id}
              currentAvatarUrl={profile.avatar_url}
              userName={profile.full_name}
            />

            <div className="mt-3">
              <div className="flex items-center justify-center gap-1.5 flex-wrap mb-1">
                {profile.display_tag ? (
                  <span className="text-[10px] font-bold text-[var(--flame-accent)] bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/20 px-2 py-0.5 rounded-full">
                    {profile.display_tag}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-[var(--bg-subtle)] text-[var(--covenant-accent)] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
                    <ShieldCheck size={11} strokeWidth={2} />
                    <span>Consecrated Disciple</span>
                  </span>
                )}
              </div>

              <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">
                {profile.full_name}
              </h2>

              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {profile.email}
              </p>

              {profile.fellowship_unit && (
                <p className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-center gap-1.5 mt-1">
                  <Building2 size={12} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                  <span>{profile.fellowship_unit}</span>
                </p>
              )}

              {profile.phone && (
                <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1 mt-0.5">
                  <Phone size={11} strokeWidth={1.75} />
                  <span>{profile.phone}</span>
                </p>
              )}

              <p className="text-[11px] text-[var(--text-faint)] flex items-center justify-center gap-1 mt-2 pt-2 border-t border-[var(--border-hairline)]">
                <Calendar size={11} />
                <span>{memberSinceText}</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── 2. My Spiritual Reflections (Journal) ─────────────── */}
        <section className="px-4 mt-4">
          <MyJournalSection />
        </section>

        {/* ── 3. Settings: Appearance & Notifications ──────────── */}
        <section className="px-4 mt-4 space-y-3">
          {/* Theme / Appearance */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-hairline)] shadow-2xs flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-ink)]">
                <Moon size={15} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--text-ink)]">
                  Appearance Theme
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Switch between light and dark modes
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Device Push Notifications */}
          <NotificationSettingsSection
            userId={profile.id}
            initialPrefs={{
              new_day_enabled: profile.new_day_enabled ?? true,
              announcements_enabled: profile.announcements_enabled ?? true,
              chat_enabled: profile.chat_enabled ?? false,
            }}
          />
        </section>

        {/* ── 4. Account Settings (Edit Name, Change Password, Sign out) ── */}
        <section className="px-4 mt-4">
          <AccountSettingsSection initialFullName={profile.full_name} />
        </section>

        {/* ── 5. Church Announcements ──────────────────────────── */}
        <div id="announcements" className="mt-4">
          <AnnouncementsSection
            announcements={announcements}
            lastSeenAt={profile.last_seen_announcements_at}
          />
        </div>
      </div>
    </div>
  )
}
