'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // Graceful fallback: service worker registration failure shouldn't disrupt the app
          console.warn('[ServiceWorkerRegister] Registration notice:', err)
        })
    }
  }, [])

  return null
}
