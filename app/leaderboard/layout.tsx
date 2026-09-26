import BottomNav from '@/components/BottomNav'

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
      <div className="max-w-md mx-auto pb-24">{children}</div>
      <BottomNav />
    </div>
  )
}
