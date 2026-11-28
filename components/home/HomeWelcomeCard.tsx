import Link from 'next/link'
import { Sparkles, Layers, HeartHandshake } from 'lucide-react'

interface HomeWelcomeCardProps {
  firstName: string
}

export default function HomeWelcomeCard({ firstName }: HomeWelcomeCardProps) {
  return (
    <section className="px-4 mt-3">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6 shadow-xs text-center transition-colors">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--flame-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--flame-accent)]/20 shadow-2xs">
          <Sparkles size={26} strokeWidth={1.75} />
        </div>

        <h2 className="text-lg font-bold text-[var(--text-ink)] font-serif mb-1.5">
          Welcome to Consecration, {firstName}!
        </h2>

        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed mb-5">
          We are delighted to walk this consecrated path with you. Join an active community challenge or enroll in a course to begin your journey.
        </p>

        <Link
          href="/challenges"
          className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 active:scale-[0.99] transition shadow-xs"
        >
          <Layers size={16} />
          <span>Explore Challenges &amp; Courses</span>
        </Link>
      </div>
    </section>
  )
}
