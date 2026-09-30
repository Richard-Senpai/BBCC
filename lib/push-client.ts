// ============================================================
// Client-side Web Push Utilities
// ============================================================

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNavStandalone = (navigator as any).standalone === true
  return Boolean(isStandalone || isNavStandalone)
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (err) {
    console.error('[push-client] Service Worker registration failed:', err)
    return null
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch (err) {
    console.error('[push-client] Error checking existing subscription:', err)
    return null
  }
}

export async function subscribeToPush(
  vapidPublicKey: string
): Promise<{ endpoint: string; p256dh: string; auth: string } | null> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.')
  }

  // 1. Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  // 2. Ensure Service Worker is registered and ready
  const registration = await registerServiceWorker()
  if (!registration) {
    throw new Error('Could not register service worker.')
  }

  const readyReg = await navigator.serviceWorker.ready

  // 3. Subscribe with VAPID key
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey)
  const subscription = await readyReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey as unknown as BufferSource,
  })

  const rawKey = subscription.getKey('p256dh')
  const rawAuth = subscription.getKey('auth')

  if (!rawKey || !rawAuth) {
    throw new Error('Subscription did not generate cryptographic keys.')
  }

  const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))))
  const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))))

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  }
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      return endpoint
    }
    return null
  } catch (err) {
    console.error('[push-client] Error unsubscribing:', err)
    return null
  }
}
