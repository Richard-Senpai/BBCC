import BottomNav from '@/components/BottomNav'

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF6EC' }}>
      <div className="max-w-md mx-auto pb-24">{children}</div>
      <BottomNav />
    </div>
  )
}
