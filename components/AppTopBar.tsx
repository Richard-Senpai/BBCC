'use client'

import UserAvatar from '@/components/UserAvatar'
import ChatNavButton from '@/components/ChatNavButton'
import AnnouncementBell from '@/components/AnnouncementBell'
import ThemeToggle from '@/components/ThemeToggle'
import type { Profile } from '@/lib/types'

interface AppTopBarProps {
  profile: Profile
  title?: string
  unreadAnnouncementsCount?: number
  isHome?: boolean
}

function getTimeAwareGreeting(timezone = 'Africa/Lagos'): string {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      }).format(new Date()),
      10
    )
    if (hour >= 4 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    return 'Good evening'
  } catch {
    return 'Welcome'
  }
}

export default function AppTopBar({
  profile,
  title = 'BBCC Consecration',
  unreadAnnouncementsCount = 0,
  isHome = false,
}: AppTopBarProps) {
  const greeting = getTimeAwareGreeting()
  const firstName = profile.full_name?.trim().split(' ')[0] || 'Brethren'

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--border-hairline)] transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Left Side: Avatar + Greeting on Home; Page Title elsewhere */}
        {isHome ? (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              avatarUrl={profile.avatar_url}
              name={profile.full_name}
              size="sm"
              className="shrink-0 ring-1 ring-[var(--border-hairline)]"
            />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-[var(--text-ink)] truncate tracking-tight">
                  {greeting}, {firstName}
                </span>
                {profile.display_tag && (
                  <span className="text-[10px] font-semibold text-[var(--flame-accent)] bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/20 px-1.5 py-0.5 rounded-md leading-none shrink-0">
                    {profile.display_tag}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Believers&apos; Banquet Community
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[var(--text-ink)] tracking-tight font-serif truncate">
              {title}
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Believers&apos; Banquet · Consecration
            </p>
          </div>
        )}

        {/* Right Side: Chat icon with unread dot + Announcement Bell with badge + Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <ChatNavButton />
          <AnnouncementBell unreadCount={unreadAnnouncementsCount} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
