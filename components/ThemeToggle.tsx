'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

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
        className={`w-8 h-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] ${className}`}
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
        w-8 h-8 rounded-xl flex items-center justify-center
        bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]
        text-[var(--text-muted)] hover:text-[var(--text-ink)]
        border border-[var(--border-subtle)]
        transition-colors shadow-2xs
        ${className}
      `}
    >
      {isDark ? (
        <Sun size={15} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
      ) : (
        <Moon size={15} strokeWidth={1.75} className="text-[var(--text-muted)]" />
      )}
    </button>
  )
}
