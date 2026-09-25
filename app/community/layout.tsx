import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Community Wall | BBCC 40-Day Challenge',
  description: 'Fellowship prayer wall and daily encouragement for BBCCILEIFE.',
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FAF6EC] dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 transition-colors">
      <div className="max-w-md mx-auto relative">{children}</div>
      <BottomNav />
    </div>
  )
}
