import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'full_name' | 'role'> | null; error: unknown }

  // If somehow an admin lands here, send them to /admin
  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  return (
    <main className="min-h-screen bg-amber-50">
      {/* Top nav */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg font-bold">✝</span>
            <span className="text-amber-900 font-semibold text-sm tracking-wide">
              BBCCILEIFE
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-900 mb-2">
          Welcome, {profile?.full_name?.split(' ')[0] ?? 'friend'}! 👋
        </h1>
        <p className="text-amber-700 text-lg mb-8">
          Your 40-day journey starts here.
        </p>

        {/* Placeholder card */}
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md mx-auto border border-amber-100">
          <div className="text-5xl mb-4">🌅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Challenge coming soon
          </h2>
          <p className="text-gray-500 text-sm">
            Daily challenges will appear here once your admin sets the
            start date. Stay ready!
          </p>
        </div>
      </div>
    </main>
  )
}
