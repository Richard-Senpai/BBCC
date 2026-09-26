'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Mail,
  Phone,
  Users,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  PhoneCall,
  Flame,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import { FELLOWSHIP_UNITS } from '@/lib/types'

export default function SignupPage() {
  const router = useRouter()

  const [tab, setTab] = useState<'register' | 'login'>('register')

  // Dynamic branding state
  const [challengeBranding, setChallengeBranding] = useState({
    duration_days: 40,
    challenge_name: 'Overcomer',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('challenge_settings')
      .select('duration_days, challenge_name')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setChallengeBranding({
            duration_days: data.duration_days ?? 40,
            challenge_name: data.challenge_name ?? 'Overcomer',
          })
        }
      })
  }, [])

  // Register state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fellowship, setFellowship] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // ── Register ───────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), phone, fellowship_unit: fellowship },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Update profile with extra fields immediately
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('profiles')
        .update({ phone, fellowship_unit: fellowship })
        .eq('id', user.id)
      router.push('/dashboard')
      router.refresh()
    } else {
      setEmailSent(true)
    }
    setLoading(false)
  }

  // ── Login ──────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = (await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()) as { data: { role: string } | null; error: unknown }

      router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  // ── Email sent confirmation ────────────────────────────────
  if (emailSent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
        <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl shadow-xs p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center mb-4 border border-[var(--border-hairline)]">
            <Mail size={22} strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold text-[var(--text-ink)] mb-2">
            Check your email
          </h2>
          <p className="text-[var(--text-muted)] text-xs leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-[var(--flame-accent)]">{email}</span>.
            Click it to activate your account and join the corporate consecration.
          </p>
          <button
            onClick={() => {
              setEmailSent(false)
              setTab('login')
            }}
            className="mt-6 text-xs text-[var(--flame-accent)] font-medium hover:underline cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>
      </main>
    )
  }

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
          {challengeBranding.duration_days} Days of {challengeBranding.challenge_name}
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl shadow-xs overflow-hidden transition-colors">
        {/* Tab toggle */}
        <div className="flex bg-[var(--bg-subtle)] m-3 rounded-xl p-1 border border-[var(--border-hairline)]">
          {(['register', 'login'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setError(null)
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === t
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              {t === 'register' ? 'Register' : 'Sign In'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          {/* ── REGISTER FORM ─────────────────────────────── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <Field label="Full Name" icon={<User size={13} strokeWidth={1.75} />}>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. David Oluwaseun"
                  className={inputCls}
                />
              </Field>

              <Field label="Email Address" icon={<Mail size={13} strokeWidth={1.75} />}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@bbcc.org.ng"
                  className={inputCls}
                />
              </Field>

              <Field label="WhatsApp Phone Number" icon={<Phone size={13} strokeWidth={1.75} />}>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className={inputCls}
                />
              </Field>

              <Field label="Fellowship Unit" icon={<Users size={13} strokeWidth={1.75} />}>
                <select
                  value={fellowship}
                  onChange={(e) => setFellowship(e.target.value)}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="">Select your church unit…</option>
                  {FELLOWSHIP_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Password" icon={<Lock size={13} strokeWidth={1.75} />}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`${inputCls} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              {error && <ErrorMsg msg={error} />}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Flame size={13} strokeWidth={1.75} />
                <span>
                  {loading
                    ? 'Creating account…'
                    : `Enlist for ${challengeBranding.duration_days} Days of ${challengeBranding.challenge_name}`}
                </span>
              </button>

              <p className="text-[10px] text-[var(--text-muted)] text-center">
                By joining, you commit to daily personal consecration and fellowship accountability.
              </p>
            </form>
          )}

          {/* ── LOGIN FORM ────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field label="Email Address" icon={<Mail size={13} strokeWidth={1.75} />}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="member@bbcc.org.ng"
                  className={inputCls}
                />
              </Field>

              <Field label="Password" icon={<Lock size={13} strokeWidth={1.75} />}>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  className={inputCls}
                />
              </Field>

              {error && <ErrorMsg msg={error} />}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs transition cursor-pointer"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Help links */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-hairline)]">
            <button className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 hover:text-[var(--text-ink)] cursor-pointer">
              <HelpCircle size={12} strokeWidth={1.75} />
              <span>Need Help?</span>
            </button>
            <button className="text-[11px] text-[var(--flame-accent)] flex items-center gap-1 hover:underline font-medium cursor-pointer">
              <PhoneCall size={12} strokeWidth={1.75} />
              <span>Church Office</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--text-ink)] font-medium">
          Believers&apos; Banquet Christian Centre
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          Campus &amp; City Sanctuary, Ile-Ife, Osun State
        </p>
      </div>
    </main>
  )
}

// ── Accessible High-Contrast Form Inputs ────────────────────────
const inputCls =
  'w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ' +
  'bg-[var(--bg-surface)] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] ' +
  'border border-[var(--border-hairline)] ' +
  'focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] ' +
  'shadow-xs'

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-ink)] mb-1">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span>{label}</span>
      </label>
      {children}
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-2 rounded-xl">
      {msg}
    </p>
  )
}
