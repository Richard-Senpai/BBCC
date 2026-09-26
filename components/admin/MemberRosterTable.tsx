'use client'

import { useState } from 'react'
import { Users, Search, Flame, Award, Bell } from 'lucide-react'
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
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] mt-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-hairline)] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--flame-accent)]">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Ile-Ife Fellowship Member Roster &amp; Accountability
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
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
              className="px-3 py-1.5 pl-8 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] placeholder:text-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition w-48 sm:w-56 shadow-xs"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search size={12} strokeWidth={1.75} />
            </span>
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-xs cursor-pointer"
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
        <div className="mt-3 text-xs bg-green-500/10 border border-green-500/25 text-[var(--olive-accent)] px-3 py-2 rounded-lg font-medium">
          {actionNotice}
        </div>
      )}

      {/* Roster Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)] font-medium uppercase tracking-wider text-[10px]">
              <th className="pb-3 pr-4">Member Name &amp; Contact</th>
              <th className="pb-3 px-4">Fellowship Unit</th>
              <th className="pb-3 px-4 text-center">Current Streak</th>
              <th className="pb-3 px-4 text-center">Longest</th>
              <th className="pb-3 px-4">Completed</th>
              <th className="pb-3 pl-4 text-right">Pastoral Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {filtered.length > 0 ? (
              filtered.map((member) => {
                const pct = Math.round((member.total_completed / durationDays) * 100)
                return (
                  <tr key={member.id} className="hover:bg-[var(--bg-subtle)] transition">
                    {/* Name & Avatar */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={member.avatar_url}
                          name={member.full_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[var(--text-ink)] truncate">
                            {member.full_name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Fellowship Unit */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]">
                        {member.fellowship_unit || 'General Assembly'}
                      </span>
                    </td>

                    {/* Current Streak */}
                    <td className="py-3 px-4 text-center font-medium text-[var(--flame-accent)]">
                      {member.current_streak > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Flame size={12} strokeWidth={1.75} />
                          {member.current_streak} Days
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0 Days</span>
                      )}
                    </td>

                    {/* Longest */}
                    <td className="py-3 px-4 text-center text-[var(--text-muted)] font-medium">
                      {member.longest_run} Days
                    </td>

                    {/* Completed Progress */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="font-medium text-[var(--text-ink)] text-xs w-10">
                          {member.total_completed}/{durationDays}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 50 ? 'bg-[var(--olive-accent)]' : 'bg-[var(--flame-accent)]'
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
                            className="px-2.5 py-1 text-[10px] font-medium text-[var(--olive-accent)] bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] rounded-md border border-[var(--border-hairline)] transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>Commend</span>
                            <Award size={11} strokeWidth={1.75} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAction(member.full_name, 'Remind')}
                            className="px-2.5 py-1 text-[10px] font-medium text-[var(--flame-accent)] bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] rounded-md border border-[var(--border-hairline)] transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>Remind</span>
                            <Bell size={11} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No members found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>
          Showing {filtered.length} of {members.length} registered disciples
        </span>
      </div>
    </section>
  )
}
