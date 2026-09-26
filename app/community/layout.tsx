import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Community Wall | BBCC Fellowship Challenge',
  description: 'Fellowship prayer wall and daily encouragement for BBCCILEIFE.',
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
      <div className="max-w-md mx-auto relative">{children}</div>
      <BottomNav />
    </div>
  )
}
