/**
 * BBCC Course Editor Utilities
 *
 * Helpers for:
 * 1. Client-side image validation, compression, and scaling (max 1600px wide, max 5MB).
 * 2. YouTube URL parsing and 11-character video ID extraction (with start time).
 * 3. Link button validation.
 */

// ─────────────────────────────────────────────────────────────
// 1. IMAGE COMPRESSION & RESIZING (Browser only)
// ─────────────────────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean
  error?: string
}

export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' }
  }

  // Allowed MIME types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF).',
    }
  }

  // Max 5MB
  const maxBytes = 5 * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 5MB.`,
    }
  }

  return { valid: true }
}

/**
 * Resizes an image client-side to a max width of 1600px and compresses to WebP/JPEG blob.
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 1600,
  quality = 0.85
): Promise<{ blob: Blob; fileName: string }> {
  // Validate first
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.')
  }

  // GIFs: Keep original to preserve animation frames
  if (file.type.toLowerCase() === 'image/gif') {
    return { blob: file, fileName: file.name }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let targetWidth = img.naturalWidth || img.width
      let targetHeight = img.naturalHeight || img.height

      if (targetWidth > maxWidth) {
        const ratio = maxWidth / targetWidth
        targetWidth = maxWidth
        targetHeight = Math.round(targetHeight * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Fallback to original file if canvas not supported
        resolve({ blob: file, fileName: file.name })
        return
      }

      // Draw with smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

      // Prefer WebP if supported, fallback to JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ blob: file, fileName: file.name })
            return
          }
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image'
          resolve({ blob, fileName: `${baseName}.webp` })
        },
        'image/webp',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for processing.'))
    }

    img.src = objectUrl
  })
}

// ─────────────────────────────────────────────────────────────
// 2. YOUTUBE URL PARSER
// ─────────────────────────────────────────────────────────────

export interface YouTubeParseResult {
  videoId: string | null
  startSeconds: number | null
  error?: string
}

/**
 * Parses time formats:
 * - 90 / 90s -> 90
 * - 1m30s -> 90
 * - 1h2m3s -> 3723
 */
function parseStartTime(tParam: string | null): number | null {
  if (!tParam) return null

  // Pure digits
  if (/^\d+$/.test(tParam)) {
    return parseInt(tParam, 10)
  }

  let totalSeconds = 0
  const hours = tParam.match(/(\d+)h/i)
  const mins = tParam.match(/(\d+)m/i)
  const secs = tParam.match(/(\d+)s/i)

  if (hours) totalSeconds += parseInt(hours[1], 10) * 3600
  if (mins) totalSeconds += parseInt(mins[1], 10) * 60
  if (secs) totalSeconds += parseInt(secs[1], 10)

  return totalSeconds > 0 ? totalSeconds : null
}

/**
 * Extracts the 11-character YouTube video ID and optional start time.
 * Accepts watch, youtu.be, shorts, live, and embed URL formats.
 * Rejects non-YouTube URLs with a clear inline message.
 */
export function extractYouTubeVideoId(inputUrl: string): YouTubeParseResult {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { videoId: null, startSeconds: null, error: 'Please enter a YouTube link.' }
  }

  const trimmed = inputUrl.trim()
  if (!trimmed) {
    return { videoId: null, startSeconds: null, error: 'Please enter a YouTube link.' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`)
  } catch {
    return {
      videoId: null,
      startSeconds: null,
      error: 'Please enter a valid URL (e.g. https://www.youtube.com/watch?v=...).',
    }
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const validHostnames = ['youtube.com', 'youtu.be', 'youtube-nocookie.com']

  if (!validHostnames.includes(hostname)) {
    return {
      videoId: null,
      startSeconds: null,
      error: 'Only YouTube video links are supported (watch, youtu.be, shorts, live, or embed).',
    }
  }

  let videoId: string | null = null
  let startSeconds: number | null = null

  // 1. youtu.be/<id>
  if (hostname === 'youtu.be') {
    const path = parsed.pathname.replace(/^\//, '')
    if (path) {
      videoId = path.split('/')[0]
    }
    startSeconds = parseStartTime(parsed.searchParams.get('t') || parsed.searchParams.get('start'))
  }
  // 2. youtube.com
  else {
    const pathname = parsed.pathname

    // /watch?v=<id>
    if (pathname === '/watch') {
      videoId = parsed.searchParams.get('v')
      startSeconds = parseStartTime(parsed.searchParams.get('t') || parsed.searchParams.get('start'))
    }
    // /shorts/<id>
    else if (pathname.startsWith('/shorts/')) {
      const parts = pathname.split('/')
      videoId = parts[2] || null
      startSeconds = parseStartTime(parsed.searchParams.get('t') || parsed.searchParams.get('start'))
    }
    // /live/<id>
    else if (pathname.startsWith('/live/')) {
      const parts = pathname.split('/')
      videoId = parts[2] || null
      startSeconds = parseStartTime(parsed.searchParams.get('t') || parsed.searchParams.get('start'))
    }
    // /embed/<id>
    else if (pathname.startsWith('/embed/')) {
      const parts = pathname.split('/')
      videoId = parts[2] || null
      startSeconds = parseStartTime(parsed.searchParams.get('start') || parsed.searchParams.get('t'))
    }
  }

  // Validate 11 characters
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      videoId: null,
      startSeconds: null,
      error: 'Could not find a valid 11-character YouTube video ID in the provided link.',
    }
  }

  return { videoId, startSeconds }
}

// ─────────────────────────────────────────────────────────────
// 3. LINK BUTTON URL VALIDATOR
// ─────────────────────────────────────────────────────────────

export function validateButtonLinkUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: 'URL cannot be empty.' }
  }

  const trimmed = url.trim().toLowerCase()
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return { valid: false, error: 'Invalid URL scheme. Only http:// or https:// links are permitted.' }
  }

  if (!/^https?:\/\//i.test(url.trim())) {
    return { valid: false, error: 'URL must start with http:// or https://' }
  }

  try {
    new URL(url.trim())
    return { valid: true }
  } catch {
    return { valid: false, error: 'Please enter a well-formed web address.' }
  }
}
