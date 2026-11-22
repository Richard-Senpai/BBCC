'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, Check, AlertCircle, Loader2, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateProfileName } from '@/lib/actions/profile'
import LogoutButton from '@/components/LogoutButton'

interface AccountSettingsSectionProps {
  initialFullName: string
}

export default function AccountSettingsSection({
  initialFullName,
}: AccountSettingsSectionProps) {
  const router = useRouter()

  // Name State
  const [fullName, setFullName] = useState(initialFullName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Handle Name Update
  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    setNameSuccess(false)

    if (fullName.trim().length < 2) {
      setNameError('Full name must be at least 2 characters.')
      return
    }

    setNameSaving(true)
    const res = await updateProfileName(fullName.trim())
    setNameSaving(false)

    if (!res.success) {
      setNameError(res.error || 'Failed to update name.')
    } else {
      setNameSuccess(true)
      router.refresh()
      setTimeout(() => setNameSuccess(false), 3000)
    }
  }

  // Handle Password Update
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess(true)
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPasswordSuccess(false), 4000)
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Edit Full Name Form ────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-hairline)] shadow-2xs transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <User size={15} className="text-[var(--flame-accent)]" />
          <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            Display Name
          </h3>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-3">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1"
            >
              Full Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bbcc-input"
              placeholder="Your full name"
              required
            />
          </div>

          {nameError && (
            <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle size={13} className="shrink-0" />
              <span>{nameError}</span>
            </div>
          )}

          {nameSuccess && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <Check size={13} className="shrink-0" />
              <span>Full name updated successfully.</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={nameSaving || fullName.trim() === initialFullName}
              className="py-1.5 px-4 rounded-xl text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              {nameSaving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Name</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change Password Form ───────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-hairline)] shadow-2xs transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={15} className="text-[var(--flame-accent)]" />
          <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            Security &amp; Password
          </h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label
              htmlFor="new-password"
              className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1"
            >
              New Password (minimum 8 characters)
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bbcc-input"
              placeholder="••••••••"
              minLength={8}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bbcc-input"
              placeholder="••••••••"
              minLength={8}
            />
          </div>

          {passwordError && (
            <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle size={13} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <Check size={13} className="shrink-0" />
              <span>Password updated securely.</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving || !newPassword}
              className="py-1.5 px-4 rounded-xl text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              {passwordSaving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Sign Out Button ────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-hairline)] text-center shadow-2xs">
        <LogoutButton />
      </div>
    </div>
  )
}
