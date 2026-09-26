'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck2,
  TrendingUp,
  MessageSquare,
  Trophy,
  User,
} from 'lucide-react'

const tabs = [
  {
    label: 'Today',
    href: '/dashboard',
    Icon: CalendarCheck2,
  },
  {
    label: 'Progress',
    href: '/dashboard/progress',
    Icon: TrendingUp,
  },
  {
    label: 'Community',
    href: '/community',
    Icon: MessageSquare,
  },
  {
    label: 'Leaderboard',
    href: '/leaderboard',
    Icon: Trophy,
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    Icon: User,
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] safe-area-pb transition-colors shadow-xs">
      <div className="max-w-md mx-auto flex items-center h-16 px-1">
        {tabs.map((tab) => {
          const active =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href)

          const IconComponent = tab.Icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-colors relative ${
                active
                  ? 'text-[var(--flame-accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              <div className="relative">
                <IconComponent
                  size={20}
                  strokeWidth={active ? 2.2 : 1.75}
                  className="transition-transform duration-150"
                />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--flame-accent)]" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium tracking-tight ${
                  active ? 'font-semibold text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

