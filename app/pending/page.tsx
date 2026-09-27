'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  ShieldAlert,
  LogOut,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import type { Profile, UserStatus } from '@/lib/types'

export default function PendingApprovalPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [justApproved, setJustApproved] = useState(false)

  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) setChecking(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !prof) {
        console.error('Error fetching profile status:', error)
        return
      }

      setProfile(prof as Profile)
      const currentStatus: UserStatus =
        prof.role === 'admin'
          ? 'approved'
          : (prof.status as UserStatus) || 'approved'

      setStatus(currentStatus)

      if (currentStatus === 'approved') {
        setJustApproved(true)
        setTimeout(() => {
          router.push(prof.role === 'admin' ? '/admin' : '/dashboard')
          router.refresh()
        }, 1200)
      }
    } finally {
      setLoading(false)
      if (isManual) {
        setTimeout(() => setChecking(false), 500)
      }
    }
  }, [supabase, router])

  useEffect(() => {
    checkStatus()

    // 1. Subscribe to realtime profile updates for instant navigation upon admin approval
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        channel = supabase
          .channel(`profile-status-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              const updatedStatus = (payload.new as { status?: UserStatus }).status
              if (updatedStatus === 'approved') {
                setJustApproved(true)
                setTimeout(() => {
                  router.push('/dashboard')
                  router.refresh()
                }, 1000)
              } else if (updatedStatus) {
                setStatus(updatedStatus)
              }
            }
          )
          .subscribe()
      }
    })

    // 2. Fallback gentle polling every 8 seconds in case Realtime is reconnecting
    const interval = setInterval(() => {
      checkStatus()
    }, 8000)

    return () => {
      if (channel) supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [checkStatus, supabase, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-ink)]">
        <div className="flex flex-col items-center gap-3">
          <BBCCLogo size="md" className="animate-pulse" />
          <p className="text-xs text-[var(--text-muted)] font-medium">Checking your account status…</p>
        </div>
      </main>
    )
  }

  const isRejected = status === 'rejected'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Church branding */}
      <div className="mb-6 text-center">
        <BBCCLogo size="lg" className="mx-auto mb-3" />
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-ink)]">
          Believers&apos; Banquet Christian Centre
        </h1>
        <p className="text-[var(--flame-accent)] text-xs font-medium mt-0.5">
          ...Raising Kingdom Leaders
        </p>
      </div>

      {/* Holding Card */}
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl shadow-xs overflow-hidden transition-colors">
        <div className="p-6 sm:p-8 text-center">
          {justApproved ? (
            <div className="py-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--covenant-subtle)] text-[var(--covenant-accent)] border border-[var(--covenant-accent)]/30 flex items-center justify-center shadow-xs">
                <CheckCircle2 size={26} strokeWidth={2} className="animate-check-spring" />
              </div>
              <h2 className="text-base font-semibold text-[var(--text-ink)] mb-1">
                Account Approved!
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome to the fellowship challenge. Redirecting to your dashboard…
              </p>
            </div>
          ) : isRejected ? (
            /* ── REJECTED NOTICE ─────────────────────────────── */
            <div>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)] flex items-center justify-center shadow-xs">
                <ShieldAlert size={24} strokeWidth={1.75} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)] mb-3">
                <span>Membership Notice</span>
              </div>

              <h2 className="text-base font-semibold text-[var(--text-ink)] mb-2">
                Account Notice
              </h2>

              <p className="text-xs font-medium text-[var(--text-ink)] leading-relaxed mb-3">
                Please reach out to church admin about your account.
              </p>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-6">
                We were unable to confirm your church fellowship membership at this time.
                If you are a member of Believers&apos; Banquet Christian Centre or feel this is an oversight,
                please contact the church administration desk.
              </p>

              {/* User details pill */}
              {profile && (
                <div className="bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl p-3 mb-6 text-left text-xs">
                  <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] mb-1">
                    <span>Registered Account</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">Needs Review</span>
                  </div>
                  <p className="font-semibold text-xs text-[var(--text-ink)]">{profile.full_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{profile.email}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5">
                <a
                  href="tel:+2348030000000"
                  className="w-full py-2.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] border border-[var(--border-hairline)] text-[var(--text-ink)] font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <PhoneCall size={13} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                  <span>Contact Church Office</span>
                </a>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 text-[var(--text-muted)] hover:text-[var(--text-ink)] font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut size={13} strokeWidth={1.75} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* ── PENDING APPROVAL HOLDING VIEW ────────────────── */
            <div>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/20 flex items-center justify-center shadow-xs">
                <Clock size={24} strokeWidth={1.75} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/30 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)] animate-pulse" />
                <span>Awaiting Church Admin Approval</span>
              </div>

              <h2 className="text-base font-semibold text-[var(--text-ink)] mb-2">
                Registration Received
              </h2>

              <p className="text-xs font-medium text-[var(--text-ink)] leading-relaxed mb-3">
                Thanks for signing up! Your account is awaiting approval from church admin. Check back soon.
              </p>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-6">
                Because this is a church community, our pastoral team verifies each member
                to ensure you are connected to the BBCC congregation before granting access to our corporate challenge,
                prayer altar, and fellowship spaces.
              </p>

              {/* User details pill */}
              {profile && (
                <div className="bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl p-3 mb-6 text-left text-xs">
                  <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] mb-1">
                    <span>Account Details</span>
                    <span className="font-medium text-[var(--flame-accent)]">Pending Approval</span>
                  </div>
                  <p className="font-semibold text-xs text-[var(--text-ink)]">{profile.full_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{profile.email}</p>
                  {profile.fellowship_unit && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Unit: <span className="font-medium text-[var(--text-ink)]">{profile.fellowship_unit}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => checkStatus(true)}
                  disabled={checking}
                  className="w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <RefreshCw
                    size={13}
                    strokeWidth={1.75}
                    className={checking ? 'animate-spin' : ''}
                  />
                  <span>{checking ? 'Checking Status…' : 'Check Approval Status'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 text-[var(--text-muted)] hover:text-[var(--text-ink)] font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut size={13} strokeWidth={1.75} />
                  <span>Sign Out</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-hairline)]">
                <p className="text-[10px] text-[var(--text-muted)] flex items-center justify-center gap-1">
                  <Sparkles size={11} className="text-[var(--flame-accent)]" />
                  <span>This page automatically updates the moment your account is approved.</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--text-ink)] font-medium">
          Believers&apos; Banquet Christian Centre
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          BBCC, Ile-Ife, Osun State
        </p>
      </div>
    </main>
  )
}
