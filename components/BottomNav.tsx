'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Layers, User } from 'lucide-react'

const tabs = [
  {
    id: 'home',
    label: 'Home',
    href: '/home',
    Icon: Home,
  },
  {
    id: 'challenges',
    label: 'Challenges',
    href: '/challenges',
    Icon: Layers,
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    Icon: User,
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  // 1. Hide bottom tab bar on non-member or excluded routes:
  // - Chat page (/community): has typing box colliding with tab bar
  // - Course lesson page (/courses/[id]/lessons/[lessonId]): has sticky completion bar
  // - Auth pages (/login, /signup, /pending)
  // - Admin pages (/admin)
  // - Root page (/)
  if (
    !pathname ||
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/pending') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/community') ||
    /^\/courses\/[^/]+\/lessons\/[^/]+/.test(pathname)
  ) {
    return null
  }

  // 2. Active tab determination:
  // Inside a daily challenge (/dashboard*) or course overview (/courses*), Challenges tab stays active
  let activeHref = '/home'
  if (pathname.startsWith('/home')) {
    activeHref = '/home'
  } else if (
    pathname.startsWith('/challenges') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/courses') ||
    pathname.startsWith('/hub')
  ) {
    activeHref = '/challenges'
  } else if (pathname.startsWith('/profile')) {
    activeHref = '/profile'
  }

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] transition-colors shadow-xs"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md mx-auto flex items-center h-16 px-4">
        {tabs.map((tab) => {
          const active = tab.href === activeHref
          const IconComponent = tab.Icon

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 transition-colors relative cursor-pointer select-none ${
                active
                  ? 'text-[var(--flame-accent)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <IconComponent
                  size={21}
                  strokeWidth={active ? 2.3 : 1.75}
                  className="transition-transform duration-150"
                />

                {/* Active tab bottom indicator dot */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)]"
                  />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight transition-colors ${
                  active
                    ? 'text-[var(--flame-accent)] font-semibold'
                    : 'text-[var(--text-muted)] font-medium'
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
