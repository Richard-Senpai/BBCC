import BottomNav from '@/components/BottomNav'

/**
 * Dashboard layout — wraps all /dashboard routes.
 * Provides the warm cream background in light mode and sleek dark in dark mode.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FAF6EC] dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 transition-colors">
      <div className="max-w-md mx-auto pb-24">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
