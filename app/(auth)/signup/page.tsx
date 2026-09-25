'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BBCCLogo from '@/components/BBCCLogo'
import { FELLOWSHIP_UNITS } from '@/lib/types'

export default function SignupPage() {
  const router = useRouter()

  const [tab, setTab] = useState<'register' | 'login'>('register')

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
      await supabase.from('profiles').update({ phone, fellowship_unit: fellowship }).eq('id', user.id)
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single() as { data: { role: string } | null; error: unknown }

      router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  // ── Email sent confirmation ────────────────────────────────
  if (emailSent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#FAF6EC' }}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-amber-700">{email}</span>.
            Click it to activate your account and join the challenge!
          </p>
          <button
            onClick={() => { setEmailSent(false); setTab('login') }}
            className="mt-6 text-sm text-amber-700 font-semibold hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ backgroundColor: '#FAF6EC' }}>
      {/* Church branding */}
      <div className="mb-6 text-center">
        <BBCCLogo size="lg" className="mx-auto mb-3" />
        <h1 className="text-xl font-black text-gray-900">
          Believers&apos; Banquet Christian Centre
        </h1>
        <p className="text-amber-600 text-sm font-semibold mt-0.5">
          40 Days of Consecration &amp; Spiritual Discipline
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md overflow-hidden">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 m-3 rounded-xl p-1">
          {(['register', 'login'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'register' ? 'Register' : 'Sign In'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          {/* ── REGISTER FORM ─────────────────────────────── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <Field label="Full Name" icon="👤">
                <input
                  type="text" required autoComplete="name"
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. David Oluwaseun"
                  className={inputCls}
                />
              </Field>

              <Field label="Email Address" icon="✉️">
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@bbcc.org.ng"
                  className={inputCls}
                />
              </Field>

              <Field label="WhatsApp Phone Number" icon="📞">
                <input
                  type="tel" autoComplete="tel"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className={inputCls}
                />
              </Field>

              <Field label="Fellowship Unit" icon="👥">
                <select
                  value={fellowship} onChange={(e) => setFellowship(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">Select your church unit…</option>
                  {FELLOWSHIP_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>

              <Field label="Password" icon="🔒">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required autoComplete="new-password" minLength={8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>

              {error && <ErrorMsg msg={error} />}

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition"
              >
                🚩 {loading ? 'Creating account…' : 'Enlist for 40-Day Challenge'}
              </button>

              <p className="text-[10px] text-gray-400 text-center">
                By joining, you commit to daily personal consecration and
                fellowship accountability.
              </p>
            </form>
          )}

          {/* ── LOGIN FORM ────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <Field label="Email Address" icon="✉️">
                <input
                  type="email" required autoComplete="email"
                  value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="member@bbcc.org.ng"
                  className={inputCls}
                />
              </Field>

              <Field label="Password" icon="🔒">
                <input
                  type="password" required autoComplete="current-password"
                  value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  className={inputCls}
                />
              </Field>

              {error && <ErrorMsg msg={error} />}

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-black rounded-xl text-sm transition"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Help links */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <button className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700">
              ❓ Need Help?
            </button>
            <button className="text-xs text-amber-600 flex items-center gap-1 hover:underline font-medium">
              📞 Contact Church Office
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-700 font-semibold">
          Believers&apos; Banquet Christian Centre
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Campus &amp; City Sanctuary, Ile-Ife, Osun State
        </p>
        <button className="text-[10px] text-amber-600 mt-1 hover:underline">
          🌐 Direct Line: Pastoral Helpdesk
        </button>
      </div>
    </main>
  )
}

// ── Tiny helpers ───────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300 transition'

function Field({
  label, icon, children,
}: {
  label: string; icon: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
        <span>{icon}</span> {label}
      </label>
      {children}
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{msg}</p>
  )
}
