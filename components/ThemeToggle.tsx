'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('bbcc-theme')
    const currentIsDark =
      saved === 'dark' ||
      (!saved &&
        typeof window !== 'undefined' &&
        document.documentElement.classList.contains('dark'))
    setIsDark(currentIsDark)
    if (currentIsDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  function toggleTheme() {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('bbcc-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('bbcc-theme', 'light')
    }
  }

  // Avoid hydration mismatch by rendering a placeholder until mounted
  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-xl bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 ${className}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`
        w-8 h-8 rounded-xl flex items-center justify-center text-sm
        transition-all duration-200 shadow-sm
        ${
          isDark
            ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700'
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
        }
        ${className}
      `}
    >
      {isDark ? (
        <span role="img" aria-label="Sun">
          ☀️
        </span>
      ) : (
        <span role="img" aria-label="Moon">
          🌙
        </span>
      )}
    </button>
  )
}
