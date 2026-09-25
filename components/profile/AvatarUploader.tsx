'use client'

import { useState, useRef } from 'react'
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
        <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-md bg-gray-100 dark:bg-zinc-800">
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
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-zinc-900 transition"
        >
          📷
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
            className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
          >
            {loading ? 'Uploading…' : '✓ Save Avatar'}
          </button>
          <button
            type="button"
            onClick={handleCancelPreview}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-zinc-200 font-semibold text-xs rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-1.5 rounded-xl text-center">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 px-3 py-1.5 rounded-xl text-center">
          {success}
        </p>
      )}
    </div>
  )
}
