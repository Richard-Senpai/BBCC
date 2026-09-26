'use client'

import { useState } from 'react'
import UserAvatar from '@/components/UserAvatar'
import { FELLOWSHIP_UNITS } from '@/lib/types'

export interface MemberRosterItem {
  id: string
  full_name: string
  email: string
  fellowship_unit: string
  avatar_url?: string | null
  current_streak: number
  longest_run: number
  total_completed: number
  last_activity_date: string | null
}

interface MemberRosterTableProps {
  members: MemberRosterItem[]
  durationDays?: number
}

export default function MemberRosterTable({
  members,
  durationDays = 40,
}: MemberRosterTableProps) {
  const [search, setSearch] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<string>('All')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const filtered = members.filter((m) => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchesUnit =
      selectedUnit === 'All' || m.fellowship_unit === selectedUnit
    return matchesSearch && matchesUnit
  })

  function handleAction(memberName: string, action: string) {
    setActionNotice(`Pastoral action "${action}" triggered for ${memberName}`)
    setTimeout(() => setActionNotice(null), 3500)
  }

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800 mt-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <h2 className="text-base font-black text-gray-900 dark:text-zinc-100">
              Ile-Ife Fellowship Member Roster &amp; Accountability
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Tracking daily devotional engagement, prayer fidelity, and pastoral follow-ups.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member by name..."
              className="px-3 py-1.5 pl-8 text-xs font-semibold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition w-48 sm:w-56 shadow-sm"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-xs">
              🔍
            </span>
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-white text-gray-900 border border-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-sm cursor-pointer"
          >
            <option value="All">All Units</option>
            {FELLOWSHIP_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionNotice && (
        <div className="mt-3 text-xs bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-3 py-2 rounded-xl">
          ✓ {actionNotice}
        </div>
      )}

      {/* Roster Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="pb-3 pr-4">Member Name &amp; Contact</th>
              <th className="pb-3 px-4">Fellowship Unit</th>
              <th className="pb-3 px-4 text-center">Current Streak</th>
              <th className="pb-3 px-4 text-center">Longest</th>
              <th className="pb-3 px-4">Completed</th>
              <th className="pb-3 pl-4 text-right">Pastoral Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {filtered.length > 0 ? (
              filtered.map((member) => {
                const pct = Math.round((member.total_completed / durationDays) * 100)
                return (
                  <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition">
                    {/* Name & Avatar */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={member.avatar_url}
                          name={member.full_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-zinc-100 truncate">
                            {member.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Fellowship Unit */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                        {member.fellowship_unit || 'General Assembly'}
                      </span>
                    </td>

                    {/* Current Streak */}
                    <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                      {member.current_streak > 0
                        ? `🔥 ${member.current_streak} Days`
                        : '0 Days'}
                    </td>

                    {/* Longest */}
                    <td className="py-3 px-4 text-center text-gray-500 dark:text-zinc-400 font-medium">
                      {member.longest_run} Days
                    </td>

                    {/* Completed Progress */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="font-bold text-gray-900 dark:text-zinc-100 text-xs w-10">
                          {member.total_completed}/{durationDays}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 50 ? 'bg-green-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 pl-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {member.current_streak >= 7 ? (
                          <button
                            type="button"
                            onClick={() => handleAction(member.full_name, 'Commend')}
                            className="px-2.5 py-1 text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg border border-green-200/50 dark:border-green-800/40 transition"
                          >
                            Commend 🎖️
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAction(member.full_name, 'Remind')}
                            className="px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg border border-amber-200/50 dark:border-amber-800/40 transition"
                          >
                            Remind 🔔
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-zinc-500">
                  No members found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
        <span>
          Showing {filtered.length} of {members.length} registered disciples
        </span>
      </div>
    </section>
  )
}
