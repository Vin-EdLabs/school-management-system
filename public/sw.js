/* ScholarNerve service worker — caching + push. Bump CACHE_VERSION on breaking cache changes. */
const CACHE_VERSION = '2026-06-06-v7';
const CACHE_NAME = `scholarnerve-app-${CACHE_VERSION}`;
const APP_SHELL = ['/', '/index.html', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
  // Do not skipWaiting here — the app controls when to activate (Update now / background).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

function isStaticAsset(url) {
  return (
    /\.(?:js|mjs|css|woff2?|ttf|eot|png|jpg|jpeg|webp|gif|svg|ico|json|map)$/i.test(url.pathname) ||
    url.pathname.startsWith('/assets/')
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Dynamic manifest from API (same-origin path proxied / built).
  if (url.pathname === '/manifest.json' || url.pathname === '/site.webmanifest') {
    const apiBase =
      self.location.hostname === 'scholarnerve.com' ||
      self.location.hostname === '127.0.0.1' ||
      self.location.hostname.endsWith('.lvh.me')
        ? 'http://scholarnerve.com/api'
        : `${self.location.origin}/api`;
    const qs = url.search || '';
    const apiUrl = `${apiBase}/pwa/manifest${qs}`;

    event.respondWith(
      fetch(apiUrl)
        .then((response) => {
          if (!response.ok) throw new Error('API manifest failed');
          return response.json();
        })
        .then((data) => {
          const origin = self.location.origin;
          // Use the API origin for assets if they are relative
          const apiOrigin = apiBase.replace(/\/api$/, '');

          if (data.start_url && data.start_url.startsWith('/')) {
            data.start_url = origin + data.start_url;
          }

          if (Array.isArray(data.icons)) {
            data.icons = data.icons.map(icon => {
              if (icon.src && icon.src.startsWith('/') && !icon.src.startsWith('//')) {
                if (icon.src.startsWith('/uploads/')) {
                  icon.src = apiOrigin + icon.src;
                } else {
                  icon.src = origin + icon.src;
                }
              }
              return icon;
            });
          }

          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/manifest+json' },
          });
        })
        .catch(() => fetch('/site.webmanifest'))
    );
    return;
  }

  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // HTML navigations: network-first to avoid stale app shell after deploy (prevents blank / broken bundles).
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Hashed build assets: cache-first for speed offline; network fills cache on miss.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // Other same-origin GET: try cache then network.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
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

  const notif = data.notification || {};
  const payloadData = data.data || {};
  const title = notif.title || data.title || payloadData.title || 'ScholarNerve';
  const body = notif.body || data.body || payloadData.body || 'You have a new update.';

  let icon = notif.icon || data.icon || payloadData.icon || '/android-chrome-192x192.png';
  let badge = notif.badge || data.badge || payloadData.badge || icon;

  if (icon.startsWith('/')) icon = self.location.origin + icon;
  if (badge.startsWith('/')) badge = self.location.origin + badge;

  const url = payloadData.url || data.url || '/';

  const options = {
    body,
    icon,
    badge,
    data: { url },
  };
  const badgeCountFromPayload = Number(payloadData.unreadCount || data.unreadCount || 0);
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (!navigator.setAppBadge) return;
      if (badgeCountFromPayload > 0) {
        await navigator.setAppBadge(badgeCountFromPayload);
        return;
      }
      const notifs = await self.registration.getNotifications();
      if (notifs.length > 0) await navigator.setAppBadge(notifs.length);
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
    })()
  );
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
  event.waitUntil(
    (async () => {
      if (!self.registration.setAppBadge) return;
      const notifs = await self.registration.getNotifications();
      if (notifs.length > 0) await self.registration.setAppBadge(notifs.length);
      else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type !== 'SET_BADGE_COUNT') return;
  const count = Number(data.count || 0);
  event.waitUntil(
    (async () => {
      if (!self.registration.setAppBadge) return;
      if (count > 0) await self.registration.setAppBadge(count);
      else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
    })()
  );
});
