import BottomNav from '@/components/BottomNav'

/**
 * Dashboard layout — wraps all /dashboard routes.
 * Provides the warm cream background and fixed bottom nav.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF6EC' }}>
      {/* Content area — padded at the bottom to clear the fixed nav */}
      <div className="max-w-md mx-auto pb-24">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
