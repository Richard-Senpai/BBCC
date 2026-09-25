'use client'

import { useState } from 'react'
import { FELLOWSHIP_UNITS } from '@/lib/types'

export interface MemberRosterItem {
  id: string
  full_name: string
  email: string
  fellowship_unit: string
  current_streak: number
  longest_run: number
  total_completed: number
  last_activity_date: string | null
}

interface MemberRosterTableProps {
  members: MemberRosterItem[]
}

export default function MemberRosterTable({ members }: MemberRosterTableProps) {
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
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 mt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <h2 className="text-base font-black text-gray-900">
              Ile-Ife Fellowship Member Roster &amp; Accountability
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
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
              className="px-3 py-1.5 pl-8 text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition w-48 sm:w-56"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
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
        <div className="mt-3 text-xs bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-xl">
          ✓ {actionNotice}
        </div>
      )}

      {/* Roster Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="pb-3 pr-4">Member Name &amp; Contact</th>
              <th className="pb-3 px-4">Fellowship Unit</th>
              <th className="pb-3 px-4 text-center">Current Streak</th>
              <th className="pb-3 px-4 text-center">Longest</th>
              <th className="pb-3 px-4">Completed</th>
              <th className="pb-3 pl-4 text-right">Pastoral Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length > 0 ? (
              filtered.map((member) => {
                const pct = Math.round((member.total_completed / 40) * 100)
                return (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition">
                    {/* Name */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {member.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {member.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Fellowship Unit */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {member.fellowship_unit || 'General Assembly'}
                      </span>
                    </td>

                    {/* Current Streak */}
                    <td className="py-3 px-4 text-center font-bold text-amber-600">
                      {member.current_streak > 0
                        ? `🔥 ${member.current_streak} Days`
                        : '0 Days'}
                    </td>

                    {/* Longest */}
                    <td className="py-3 px-4 text-center text-gray-500 font-medium">
                      {member.longest_run} Days
                    </td>

                    {/* Completed Progress */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="font-bold text-gray-900 text-xs w-10">
                          {member.total_completed}/40
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
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
                            className="px-2.5 py-1 text-[10px] font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition"
                          >
                            Commend 🎖️
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAction(member.full_name, 'Remind')}
                            className="px-2.5 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
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
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  No members found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {filtered.length} of {members.length} registered disciples
        </span>
      </div>
    </section>
  )
}
