'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  Users,
  Flame,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Download,
  Calendar,
  Eye,
  Check,
  Video,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { FELLOWSHIP_UNITS } from '@/lib/types'

export interface ActivityDetail {
  id: string
  challenge_day_id: string
  description: string
  sort_order: number
  video_url?: string | null
}

export interface DayDetail {
  id: string
  day_number: number
  title: string | null
  description: string | null
  activities: ActivityDetail[]
}

export interface MemberAnalyticsItem {
  id: string
  full_name: string
  email: string
  avatar_url?: string | null
  fellowship_unit: string
  created_at: string
  current_streak: number
  longest_run: number
  total_activities_completed: number
  total_days_completed: number
  last_activity_date: string | null
  completedActivityMap: Record<string, string> // activity_id -> ISO string
  completedDayIds: string[]
}

interface AnalyticsDashboardProps {
  members: MemberAnalyticsItem[]
  days: DayDetail[]
  durationDays: number
  challengeName: string
  currentDay: number
}

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return 'N/A'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}

function formatTimestamp(isoStr: string | null | undefined): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function AnalyticsDashboard({
  members,
  days,
  durationDays,
  challengeName,
  currentDay,
}: AnalyticsDashboardProps) {
  const [search, setSearch] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('All')
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set())
  const [dayScope, setDayScope] = useState<'current' | 'all'>('current')
  const [downloading, setDownloading] = useState<string | null>(null)

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase()
      const matchesSearch =
        m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      const matchesUnit = selectedUnit === 'All' || m.fellowship_unit === selectedUnit
      return matchesSearch && matchesUnit
    })
  }, [members, search, selectedUnit])

  // Filter days based on day scope
  const visibleDays = useMemo(() => {
    if (dayScope === 'current' && currentDay > 0) {
      return days.filter((d) => d.day_number <= currentDay)
    }
    return days
  }, [days, dayScope, currentDay])

  // Summary calculations
  const totalActivitiesCount = useMemo(() => {
    return members.reduce((sum, m) => sum + m.total_activities_completed, 0)
  }, [members])

  const avgActivities = useMemo(() => {
    if (members.length === 0) return 0
    return (totalActivitiesCount / members.length).toFixed(1)
  }, [members, totalActivitiesCount])

  const avgStreak = useMemo(() => {
    if (members.length === 0) return 0
    const sum = members.reduce((acc, curr) => acc + curr.current_streak, 0)
    return Math.round(sum / members.length)
  }, [members])

  // Toggle accordion expansion
  function toggleExpand(memberId: string) {
    setExpandedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  function expandAll() {
    setExpandedMemberIds(new Set(filteredMembers.map((m) => m.id)))
  }

  function collapseAll() {
    setExpandedMemberIds(new Set())
  }

  // ── CSV Export: Summary ─────────────────────────────────────────
  function exportSummaryCsv() {
    setDownloading('summary')
    try {
      const headers = [
        'Member Name',
        'Email',
        'Fellowship Unit',
        'Join Date',
        'Current Streak (Days)',
        'Longest Streak (Days)',
        'Total Activities Completed',
        'Total Full Days Completed',
        'Last Active Date',
      ]

      const rows = filteredMembers.map((m) => [
        escapeCsv(m.full_name),
        escapeCsv(m.email),
        escapeCsv(m.fellowship_unit || 'General Assembly'),
        escapeCsv(formatDate(m.created_at)),
        m.current_streak,
        m.longest_run,
        m.total_activities_completed,
        m.total_days_completed,
        escapeCsv(formatDate(m.last_activity_date)),
      ])

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const stamp = new Date().toISOString().split('T')[0]
      triggerDownload(`bbcc_members_summary_${stamp}.csv`, csvContent)
    } finally {
      setTimeout(() => setDownloading(null), 1000)
    }
  }

  // ── CSV Export: Detailed Activity-by-Activity Breakdown ──────────
  function exportDetailedCsv() {
    setDownloading('detailed')
    try {
      const headers = [
        'Member Name',
        'Email',
        'Fellowship Unit',
        'Day Number',
        'Devotional Title',
        'Scripture Focus',
        'Activity Description',
        'Completed Status',
        'Completed Timestamp (UTC)',
        'Completed Timestamp (Formatted)',
      ]

      const rows: string[][] = []

      // For every member in filtered list, inspect every day and every activity
      for (const m of filteredMembers) {
        for (const day of visibleDays) {
          const acts = day.activities ?? []
          if (acts.length === 0) {
            rows.push([
              escapeCsv(m.full_name),
              escapeCsv(m.email),
              escapeCsv(m.fellowship_unit || 'General Assembly'),
              String(day.day_number),
              escapeCsv(day.title || `Day ${day.day_number}`),
              escapeCsv(day.description || ''),
              escapeCsv('(No activities registered)'),
              escapeCsv('N/A'),
              '""',
              '""',
            ])
          } else {
            for (const act of acts) {
              const compTime = m.completedActivityMap[act.id]
              const isComp = Boolean(compTime)
              rows.push([
                escapeCsv(m.full_name),
                escapeCsv(m.email),
                escapeCsv(m.fellowship_unit || 'General Assembly'),
                String(day.day_number),
                escapeCsv(day.title || `Day ${day.day_number}`),
                escapeCsv(day.description || ''),
                escapeCsv(act.description),
                escapeCsv(isComp ? 'Completed' : 'Not Completed'),
                escapeCsv(compTime || ''),
                escapeCsv(formatTimestamp(compTime)),
              ])
            }
          }
        }
      }

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const stamp = new Date().toISOString().split('T')[0]
      triggerDownload(`bbcc_activity_audit_detailed_${stamp}.csv`, csvContent)
    } finally {
      setTimeout(() => setDownloading(null), 1000)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar & Actions ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] transition"
            >
              <ArrowLeft size={13} strokeWidth={1.75} />
              <span>Admin Console</span>
            </Link>
            <span className="text-[var(--border-hairline)]">/</span>
            <span className="text-xs font-medium text-[var(--flame-accent)]">
              Per-Member Activity Audit
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-ink)]">
            Pastoral Analytics &amp; Accountability
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Granular activity-by-activity breakdown, spiritual discipline audit, and CSV export for {durationDays} Days of {challengeName}.
          </p>
        </div>

        {/* CSV Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportSummaryCsv}
            disabled={downloading !== null}
            className="text-xs font-medium text-[var(--text-ink)] bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] px-3 py-2 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download member summary table as CSV"
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} className="text-[var(--olive-accent)]" />
            <span>{downloading === 'summary' ? 'Exporting…' : 'Export Summary CSV'}</span>
          </button>

          <button
            type="button"
            onClick={exportDetailedCsv}
            disabled={downloading !== null}
            className="text-xs font-medium text-white bg-[var(--flame-accent)] hover:opacity-95 px-3 py-2 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download full activity-by-activity breakdown for every day"
          >
            <Download size={14} strokeWidth={1.75} />
            <span>{downloading === 'detailed' ? 'Exporting…' : 'Export Full Audit CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── 4 Summary Stat Cards ──────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Total Church Members
          </p>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] mt-1">
            {members.length} <span className="text-xs font-normal text-[var(--text-muted)]">Disciples</span>
          </p>
          <p className="text-[10px] text-[var(--olive-accent)] font-medium mt-0.5">
            Active in Consecration
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Total Activities Checked
          </p>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] mt-1">
            {totalActivitiesCount} <span className="text-xs font-normal text-[var(--text-muted)]">Acts</span>
          </p>
          <p className="text-[10px] text-[var(--olive-accent)] font-medium mt-0.5">
            Source: activity_completions
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Avg. Activities / Member
          </p>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] mt-1">
            {avgActivities} <span className="text-xs font-normal text-[var(--text-muted)]">Completed</span>
          </p>
          <p className="text-[10px] text-[var(--flame-accent)] font-medium mt-0.5">
            Per-Member Devotion
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Collective Streak
          </p>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] mt-1">
            {avgStreak} <span className="text-xs font-normal text-[var(--text-muted)]">Days Avg.</span>
          </p>
          <p className="text-[10px] text-[var(--flame-accent)] font-medium mt-0.5">
            Continuous Full Days
          </p>
        </div>
      </section>

      {/* ── Search, Filter & View Controls ───────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member by name or email…"
              className="w-full px-3 py-1.5 pl-8 text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-hairline)] placeholder:text-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-2xs"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search size={13} strokeWidth={1.75} />
            </span>
          </div>

          {/* Unit Filter */}
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-2xs cursor-pointer"
          >
            <option value="All">All Fellowship Units</option>
            {FELLOWSHIP_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>

          {/* Day Scope Toggle */}
          <div className="inline-flex rounded-lg bg-[var(--bg-subtle)] p-0.5 border border-[var(--border-hairline)] text-xs">
            <button
              type="button"
              onClick={() => setDayScope('current')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                dayScope === 'current'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              Days So Far (1..{currentDay > 0 ? currentDay : 1})
            </button>
            <button
              type="button"
              onClick={() => setDayScope('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                dayScope === 'all'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              All Days ({durationDays})
            </button>
          </div>
        </div>

        {/* Expand / Collapse All */}
        <div className="flex items-center gap-2 self-end md:self-auto text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] transition cursor-pointer"
          >
            Expand All
          </button>
          <span className="text-[var(--border-hairline)]">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] transition cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Per-Member Accordion Breakdown ────────────────────── */}
      <div className="space-y-3">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const isExpanded = expandedMemberIds.has(member.id)
            const pctDays = Math.round((member.total_days_completed / durationDays) * 100)

            return (
              <div
                key={member.id}
                className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] shadow-xs overflow-hidden transition-colors"
              >
                {/* Member Summary Header */}
                <div
                  onClick={() => toggleExpand(member.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-subtle)]/40 transition select-none"
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3">
                    <UserAvatar avatarUrl={member.avatar_url} name={member.full_name} size="md" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-[var(--text-ink)]">
                          {member.full_name}
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]">
                          {member.fellowship_unit || 'General Assembly'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text-muted)] flex-wrap">
                        <span>{member.email}</span>
                        <span>•</span>
                        <span>Joined: {formatDate(member.created_at)}</span>
                        {member.last_activity_date && (
                          <>
                            <span>•</span>
                            <span>Last Active: {formatDate(member.last_activity_date)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics + Expansion Trigger */}
                  <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
                    {/* Streak Badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--flame-accent)]">
                      <Flame size={13} strokeWidth={1.75} />
                      <span>{member.current_streak}d streak</span>
                    </div>

                    {/* Total Activities Badge */}
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-ink)]">
                      <span className="text-[var(--olive-accent)] font-bold">
                        {member.total_activities_completed}
                      </span>{' '}
                      Activities
                    </div>

                    {/* Full Days Badge */}
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-muted)]">
                      <span className="text-[var(--text-ink)] font-semibold">
                        {member.total_days_completed}/{durationDays}
                      </span>{' '}
                      Full Days ({pctDays}%)
                    </div>

                    {/* Preview Member Dashboard Link */}
                    <Link
                      href={`/dashboard?as_member=${member.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)] transition"
                      title="Preview member dashboard experience"
                    >
                      <Eye size={14} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                    </Link>

                    {/* Accordion Chevron */}
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                      className="p-1 text-[var(--text-muted)]"
                    >
                      {isExpanded ? (
                        <ChevronUp size={16} strokeWidth={2} />
                      ) : (
                        <ChevronDown size={16} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Expanded Activity Breakdown ────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)]/30 p-4 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                      <p className="text-xs font-semibold text-[var(--text-ink)]">
                        Daily Spiritual Discipline Log ({visibleDays.length} Days Audited)
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Green indicates activity was checked off by {member.full_name}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {visibleDays.map((day) => {
                        const acts = day.activities ?? []
                        const completedActsCount = acts.filter((a) =>
                          Boolean(member.completedActivityMap[a.id])
                        ).length
                        const isDayFullyComplete =
                          acts.length > 0 && completedActsCount === acts.length
                        const isPartiallyComplete =
                          completedActsCount > 0 && completedActsCount < acts.length

                        return (
                          <div
                            key={day.id}
                            className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] p-3 shadow-2xs"
                          >
                            {/* Day Header */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-hairline)]">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-[var(--flame-accent)] uppercase tracking-wider">
                                    Day {day.day_number}
                                  </span>
                                  {isDayFullyComplete && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--olive-accent)] bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                      <Check size={10} strokeWidth={2.5} />
                                      Full Day
                                    </span>
                                  )}
                                  {isPartiallyComplete && (
                                    <span className="text-[10px] font-medium text-[var(--flame-accent)] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      {completedActsCount}/{acts.length} Done
                                    </span>
                                  )}
                                  {completedActsCount === 0 && acts.length > 0 && (
                                    <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
                                      0/{acts.length} Done
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-xs font-semibold text-[var(--text-ink)] truncate mt-0.5">
                                  {day.title || `Day ${day.day_number} Devotional`}
                                </h3>
                              </div>

                              {day.description && (
                                <span className="text-[10px] text-[var(--text-muted)] font-serif italic hidden sm:inline truncate max-w-[140px]">
                                  {day.description}
                                </span>
                              )}
                            </div>

                            {/* Activities in Day */}
                            {acts.length > 0 ? (
                              <div className="space-y-1.5">
                                {acts.map((act) => {
                                  const compTime = member.completedActivityMap[act.id]
                                  const isComp = Boolean(compTime)

                                  return (
                                    <div
                                      key={act.id}
                                      className={`p-2 rounded-lg text-xs flex items-start gap-2 border transition ${
                                        isComp
                                          ? 'bg-green-500/5 border-green-500/20 text-[var(--text-ink)]'
                                          : 'bg-[var(--bg-subtle)]/40 border-transparent text-[var(--text-muted)]'
                                      }`}
                                    >
                                      <div className="mt-0.5 shrink-0">
                                        {isComp ? (
                                          <CheckCircle2
                                            size={14}
                                            strokeWidth={2}
                                            className="text-[var(--olive-accent)]"
                                          />
                                        ) : (
                                          <XCircle
                                            size={14}
                                            strokeWidth={1.75}
                                            className="text-[var(--text-muted)]/50"
                                          />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p
                                            className={`text-[11px] leading-snug ${
                                              isComp
                                                ? 'font-medium text-[var(--text-ink)]'
                                                : 'text-[var(--text-muted)]'
                                            }`}
                                          >
                                            {act.description}
                                          </p>
                                          {act.video_url && (
                                            <span title="Contains Video Link">
                                              <Video
                                                size={11}
                                                strokeWidth={1.75}
                                                className="text-[var(--flame-accent)] shrink-0"
                                              />
                                            </span>
                                          )}
                                        </div>

                                        <p className="text-[10px] mt-0.5">
                                          {isComp ? (
                                            <span className="text-[var(--olive-accent)] font-medium">
                                              Completed on {formatTimestamp(compTime)}
                                            </span>
                                          ) : (
                                            <span className="text-[var(--text-muted)]/70">
                                              Not completed
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-[var(--text-muted)] italic py-1">
                                No specific activities registered for this day yet.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] p-12 text-center">
            <Users size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h3 className="text-sm font-semibold text-[var(--text-ink)]">
              No church members match your filter
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Try adjusting your search query or fellowship unit selector.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
