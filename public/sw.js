const CACHE_NAME = 'scholarnerve-parent-v2';
const APP_SHELL = ['/', '/index.html', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve API from stale cache; always prefer fresh data.
  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'ScholarNerve';
  const options = {
    body: data.body || 'You have a new update.',
    icon: data.icon || '/vite.svg',
    badge: data.badge || data.icon || '/vite.svg',
    data: { url: data.url || '/' },
  };
  const badgeCountFromPayload = Number(data.unreadCount || 0);
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // Reflect unread count on app icon (supported browsers only).
    if (!self.registration.setAppBadge) return;
    if (badgeCountFromPayload > 0) {
      await self.registration.setAppBadge(badgeCountFromPayload);
      return;
    }
    const notifs = await self.registration.getNotifications();
    if (notifs.length > 0) await self.registration.setAppBadge(notifs.length);
    else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      if (self.registration.setAppBadge) {
        const notifs = await self.registration.getNotifications();
        if (notifs.length > 0) await self.registration.setAppBadge(notifs.length);
        else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
      }
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  event.waitUntil((async () => {
    if (!self.registration.setAppBadge) return;
    const notifs = await self.registration.getNotifications();
    if (notifs.length > 0) await self.registration.setAppBadge(notifs.length);
    else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type !== 'SET_BADGE_COUNT') return;
  const count = Number(data.count || 0);
  event.waitUntil((async () => {
    if (!self.registration.setAppBadge) return;
    if (count > 0) await self.registration.setAppBadge(count);
    else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
  })());
});

