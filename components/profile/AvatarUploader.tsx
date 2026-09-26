'use client'

import { useState, useRef } from 'react'
import { Camera, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from '@/lib/actions/profile'
import UserAvatar from '@/components/UserAvatar'

interface AvatarUploaderProps {
  userId: string
  currentAvatarUrl?: string | null
  userName: string
}

export default function AvatarUploader({
  userId,
  currentAvatarUrl,
  userName,
}: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileToUpload, setFileToUpload] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setSuccess(null)
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Cap file size at 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds 5MB limit. Please choose a smaller picture.')
      return
    }

    // 2. Validate MIME type
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, JPEG, WEBP).')
      return
    }

    // 3. Client-side square center-crop and compress via HTML5 Canvas
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 512
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Calculate aspect ratio crop
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setError('Failed to process image preview.')
              return
            }
            setFileToUpload(blob)
            setPreviewUrl(URL.createObjectURL(blob))
          },
          'image/webp',
          0.88
        )
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  async function handleConfirmUpload() {
    if (!fileToUpload) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const fileName = `${userId}/avatar-${Date.now()}.webp`

      // Upload to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, fileToUpload, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const finalUrl = publicUrlData.publicUrl

      // Persist in profile database row
      await updateAvatarUrl(finalUrl)

      setAvatarUrl(finalUrl)
      setPreviewUrl(null)
      setFileToUpload(null)
      setSuccess('Profile picture updated successfully!')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function handleCancelPreview() {
    setPreviewUrl(null)
    setFileToUpload(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center">
      {/* Circular Avatar / Preview */}
      <div className="relative group">
        <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[var(--flame-accent)]/50 shadow-xs bg-[var(--bg-subtle)]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="New Avatar Preview"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <UserAvatar
              avatarUrl={avatarUrl}
              name={userName}
              size="xl"
              className="w-full h-full"
            />
          )}
        </div>

        {/* Change photo button trigger */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload picture"
          aria-label="Upload picture"
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--flame-accent)] hover:opacity-95 text-white flex items-center justify-center shadow-xs border-2 border-[var(--bg-surface)] transition cursor-pointer"
        >
          <Camera size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Preview Confirmation Controls */}
      {previewUrl && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleConfirmUpload}
            disabled={loading}
            className="px-3 py-1.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin text-white" />
            ) : (
              <Check size={12} strokeWidth={2} />
            )}
            <span>{loading ? 'Uploading…' : 'Save Photo'}</span>
          </button>
          <button
            type="button"
            onClick={handleCancelPreview}
            disabled={loading}
            className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-ink)] border border-[var(--border-hairline)] font-medium text-xs rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-1.5 rounded-lg text-center">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-2 text-xs text-[var(--olive-accent)] bg-[var(--bg-subtle)] border border-[var(--border-hairline)] px-3 py-1.5 rounded-lg text-center font-medium">
          {success}
        </p>
      )}
    </div>
  )
}
