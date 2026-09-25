'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    label: 'Today',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-500'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: 'Progress',
    href: '/dashboard/progress',
    icon: (active: boolean) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-500'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    label: 'Community',
    href: '/community',
    icon: (active: boolean) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-500'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  },
  {
    label: 'Leaderboard',
    href: '/leaderboard',
    icon: (active: boolean) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-500'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15l-3.5 2.5 1.5-4L6 11h4l2-4.5L14 11h4l-3.5 2.5 1.5 4L12 15z"
        />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: (active: boolean) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-500'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 safe-area-pb transition-colors">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab) => {
          const active =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
              }`}
            >
              {tab.icon(active)}
              <span
                className={`text-[10px] font-medium ${
                  active
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-400 dark:text-zinc-500'
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
