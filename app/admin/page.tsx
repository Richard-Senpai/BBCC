import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/lib/types'

export default async function AdminPage() {
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

  // Non-admins are redirected by middleware, but double-check here
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg font-bold">✝</span>
            <span className="text-gray-800 font-semibold text-sm tracking-wide">
              BBCCILEIFE Admin
            </span>
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
              Admin
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Admin — {profile?.full_name}
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          Manage the 40-Day Challenge for BBCCILEIFE.
        </p>

        {/* Placeholder panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: '📅',
              title: 'Challenge Settings',
              desc: 'Set the start date and timezone for the 40-day challenge.',
            },
            {
              icon: '📖',
              title: 'Challenge Days',
              desc: 'Create and edit the 40 daily challenges and their activities.',
            },
            {
              icon: '👥',
              title: 'Members',
              desc: 'View registered members and their progress.',
            },
          ].map((panel) => (
            <div
              key={panel.title}
              className="bg-white rounded-xl border border-gray-200 p-6 opacity-60 cursor-not-allowed"
            >
              <div className="text-3xl mb-3">{panel.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-1">
                {panel.title}
              </h3>
              <p className="text-gray-500 text-sm">{panel.desc}</p>
              <span className="mt-3 inline-block text-xs text-gray-400">
                Coming next sprint
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
