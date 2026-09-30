// ============================================================
// Service Worker for BBCC Consecration Push Notifications
// ============================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Handle incoming Push Event ──────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'BBCC Consecration',
      body: event.data.text() || 'New fellowship update.',
      url: '/dashboard',
    };
  }

  const title = payload.title || 'BBCC Consecration';
  const targetUrl = payload.url || (payload.data && payload.data.url) || '/dashboard';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag: payload.tag || 'bbcc-notification',
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: targetUrl,
      category: payload.category || (payload.data && payload.data.category),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Handle notification click & navigation ───────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, navigate and focus it
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // If no window is open, launch a new window to the target URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
