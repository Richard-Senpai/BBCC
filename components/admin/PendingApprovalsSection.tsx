'use client'

import { useState } from 'react'
import {
  UserCheck,
  UserX,
  Clock,
  Search,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Users,
  ShieldCheck,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { approveMember, rejectMember } from '@/lib/actions/admin'
import type { Profile } from '@/lib/types'

interface PendingApprovalsSectionProps {
  initialPendingMembers: Profile[]
  initialRejectedMembers?: Profile[]
}

export default function PendingApprovalsSection({
  initialPendingMembers,
  initialRejectedMembers = [],
}: PendingApprovalsSectionProps) {
  const [pendingList, setPendingList] = useState<Profile[]>(initialPendingMembers)
  const [rejectedList, setRejectedList] = useState<Profile[]>(initialRejectedMembers)
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending')
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null)

  function showNotice(msg: string, type: 'success' | 'info' | 'error' = 'success') {
    setNotice({ msg, type })
    setTimeout(() => setNotice(null), 4000)
  }

  // ── Handle Approve (One Tap, Instant) ──────────────────────────
  async function handleApprove(member: Profile) {
    setLoadingId(member.id)
    try {
      const res = await approveMember(member.id)
      if (!res.success) {
        showNotice(res.error || 'Failed to approve member.', 'error')
        return
      }
      // Move from pending/rejected to approved
      setPendingList((prev) => prev.filter((m) => m.id !== member.id))
      setRejectedList((prev) => prev.filter((m) => m.id !== member.id))
      showNotice(`${member.full_name || member.email} has been approved into fellowship!`, 'success')
    } catch (err: unknown) {
      console.error('Approval failed:', err)
      const message = err instanceof Error ? err.message : 'Failed to approve member.'
      showNotice(message, 'error')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Handle Reject (Lightweight Confirm) ─────────────────────────
  async function handleConfirmReject(member: Profile) {
    setLoadingId(member.id)
    try {
      const res = await rejectMember(member.id)
      if (!res.success) {
        showNotice(res.error || 'Failed to reject member.', 'error')
        return
      }
      // Move from pending to rejected
      setPendingList((prev) => prev.filter((m) => m.id !== member.id))
      setRejectedList((prev) => [
        { ...member, status: 'rejected' },
        ...prev.filter((m) => m.id !== member.id),
      ])
      setConfirmingRejectId(null)
      showNotice(`Application for ${member.full_name || member.email} marked as rejected.`, 'info')
    } catch (err: unknown) {
      console.error('Rejection failed:', err)
      const message = err instanceof Error ? err.message : 'Failed to reject member.'
      showNotice(message, 'error')
    } finally {
      setLoadingId(null)
    }
  }

  const currentList = activeTab === 'pending' ? pendingList : rejectedList

  const filtered = currentList.filter((m) => {
    const q = search.toLowerCase()
    return (
      (m.full_name?.toLowerCase().includes(q) ?? false) ||
      (m.email?.toLowerCase().includes(q) ?? false) ||
      (m.fellowship_unit?.toLowerCase().includes(q) ?? false)
    )
  })

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Just now'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return 'Recent'
    }
  }

  return (
    <section
      id="pending-approvals"
      className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] transition-colors"
    >
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-hairline)] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--flame-accent)]">
              <UserCheck size={18} strokeWidth={1.75} />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Pending Membership Approvals
            </h2>
            {pendingList.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/30 animate-pulse">
                <span>{pendingList.length} Pending</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--covenant-subtle)] text-[var(--covenant-accent)] border border-[var(--covenant-accent)]/20">
                <Check size={11} strokeWidth={2} />
                <span>All Clear</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Confirm new registrations belong to the church congregation before granting access to challenges, prayer altar, and chats.
          </p>
        </div>

        {/* ── Tabs & Search ────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab toggle */}
          <div className="flex bg-[var(--bg-subtle)] p-0.5 rounded-lg border border-[var(--border-hairline)] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 font-medium rounded-md transition cursor-pointer text-xs ${
                activeTab === 'pending'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              Pending ({pendingList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`px-3 py-1 font-medium rounded-md transition cursor-pointer text-xs ${
                activeTab === 'rejected'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              Rejected ({rejectedList.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or email…"
              className="px-3 py-1.5 pl-8 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] placeholder:text-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition w-44 sm:w-52 shadow-xs"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search size={12} strokeWidth={1.75} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Status Feedback Banner ─────────────────────────────────── */}
      {notice && (
        <div
          className={`mt-3 text-xs px-3.5 py-2.5 rounded-lg font-medium border flex items-center justify-between transition ${
            notice.type === 'success'
              ? 'bg-[var(--covenant-subtle)] text-[var(--covenant-accent)] border-[var(--covenant-accent)]/30'
              : notice.type === 'error'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
              : 'bg-[var(--bg-subtle)] text-[var(--text-ink)] border-[var(--border-hairline)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <Check size={14} strokeWidth={2} />
            ) : notice.type === 'error' ? (
              <AlertTriangle size={14} />
            ) : (
              <Sparkles size={14} className="text-[var(--flame-accent)]" />
            )}
            <span>{notice.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-ink)]"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Members Table / List ───────────────────────────────────── */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)] font-medium uppercase tracking-wider text-[10px]">
              <th className="pb-3 pr-4">Applicant Disciple</th>
              <th className="pb-3 px-4">Fellowship Unit</th>
              <th className="pb-3 px-4">Contact Phone</th>
              <th className="pb-3 px-4">Registration Date</th>
              <th className="pb-3 pl-4 text-right">Approval Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {filtered.length > 0 ? (
              filtered.map((member) => {
                const isLoading = loadingId === member.id
                const isConfirmingReject = confirmingRejectId === member.id

                return (
                  <tr key={member.id} className="hover:bg-[var(--bg-subtle)] transition">
                    {/* Disciple Info */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={member.avatar_url}
                          name={member.full_name || member.email}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[var(--text-ink)] truncate">
                            {member.full_name || 'Unnamed Disciple'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]">
                        {member.fellowship_unit || 'General Assembly'}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 text-[11px] text-[var(--text-muted)] font-mono">
                      {member.phone || '—'}
                    </td>

                    {/* Signup Date */}
                    <td className="py-3.5 px-4 text-[11px] text-[var(--text-muted)]">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                        <span>{formatDate(member.created_at)}</span>
                      </div>
                    </td>

                    {/* Decisions */}
                    <td className="py-3.5 pl-4 text-right">
                      {isConfirmingReject ? (
                        /* Inline Confirmation for Reject */
                        <div className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 p-1 rounded-lg">
                          <span className="text-[10px] font-medium text-red-600 dark:text-red-400 px-1">
                            Confirm reject?
                          </span>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleConfirmReject(member)}
                            className="px-2 py-1 text-[10px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md transition cursor-pointer disabled:opacity-50"
                          >
                            {isLoading ? 'Rejecting…' : 'Yes, Reject'}
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => setConfirmingRejectId(null)}
                            className="px-2 py-1 text-[10px] font-medium bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] rounded-md border border-[var(--border-hairline)] transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        /* Normal Buttons: One-tap Approve & Reject */
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve Button (One-tap) */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleApprove(member)}
                            className="px-3 py-1 text-[11px] font-semibold text-white bg-[var(--covenant-accent)] hover:opacity-95 rounded-lg border border-[var(--covenant-accent)] transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                            title="Instantly approve member into church hub"
                          >
                            <Check size={12} strokeWidth={2.2} />
                            <span>{isLoading ? 'Approving…' : 'Approve'}</span>
                          </button>

                          {/* Reject Button (Lightweight prompt) */}
                          {activeTab === 'pending' ? (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => setConfirmingRejectId(member.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-red-600 bg-[var(--bg-subtle)] hover:bg-red-500/10 hover:border-red-500/25 rounded-lg border border-[var(--border-hairline)] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Reject registration"
                            >
                              <UserX size={12} strokeWidth={1.75} />
                              <span>Reject</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-medium text-[var(--text-muted)] italic px-2">
                              Rejected
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-[var(--text-muted)]">
                  <div className="max-w-xs mx-auto flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                      {activeTab === 'pending' ? (
                        <ShieldCheck size={18} strokeWidth={1.75} />
                      ) : (
                        <Users size={18} strokeWidth={1.75} />
                      )}
                    </div>
                    <p className="font-semibold text-xs text-[var(--text-ink)]">
                      {activeTab === 'pending'
                        ? 'No pending approval requests'
                        : 'No rejected member applications'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {activeTab === 'pending'
                        ? 'All registered disciples have been reviewed. New signups will appear here automatically.'
                        : 'Any members rejected from registration will be logged here and can be approved at any time.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer ───────────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[var(--text-muted)] gap-2">
        <span>
          Showing {filtered.length} of {currentList.length}{' '}
          {activeTab === 'pending' ? 'pending applicants' : 'rejected applications'}
        </span>
        <span className="text-[11px]">
          Approved members automatically gain instant access to their dashboard.
        </span>
      </div>
    </section>
  )
}
