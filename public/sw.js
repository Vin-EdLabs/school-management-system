/* ScholarNerve service worker — caching + push. Bump CACHE_VERSION on breaking cache changes. */
const CACHE_VERSION = '2026-06-07-v18';
const CACHE_NAME = `scholarnerve-app-${CACHE_VERSION}`;
const APP_SHELL = ['/', '/index.html', '/site.webmanifest'];

function getApiOrigin(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.lvh.me')) {
    return 'http://localhost:3001';
  }
  return 'https://scholarnerve.com';
}

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

function apiBaseForLocation() {
  return self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    self.location.hostname.endsWith('.lvh.me')
    ? 'http://localhost:3001/api'
    : `${self.location.origin}/api`;
}

const DYNAMIC_ICON_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
]);

function isTenantSubdomainHost(host) {
  var normalized = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!normalized || normalized === 'localhost' || normalized === '127.0.0.1') return false;
  if (
    normalized === 'scholarnerve.com' ||
    normalized === 'scholarnerve.onrender.com' ||
    normalized === 'school-management-system.onrender.com'
  ) {
    return false;
  }
  var parts = normalized.split('.').filter(Boolean);
  if (parts.length < 2) return false;
  var reserved = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal', 'school'];
  if (reserved.indexOf(parts[0]) !== -1) return false;
  if (normalized.endsWith('.localhost')) return parts.length >= 2;
  if (normalized.endsWith('.lvh.me')) return parts.length >= 3;
  if (normalized.endsWith('.onrender.com')) return parts.length >= 4;
  return parts.length >= 3;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Intercept uploads and transparently route them to the backend API origin
  if (url.pathname.startsWith('/uploads/')) {
    const apiOrigin = getApiOrigin(url.hostname);
    event.respondWith(fetch(`${apiOrigin}${url.pathname}${url.search}`));
    return;
  }

  // Intercept PWA logo requests, cache them, and transparently route them to the backend API origin
  if (url.pathname.startsWith('/api/pwa/logo/')) {
    const apiOrigin = getApiOrigin(url.hostname);
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        const response = await fetch(`${apiOrigin}${url.pathname}${url.search}`);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Dynamic manifest from API (same-origin path proxied / built).
  // Replace lines 46-70 with:
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

          // Make sure start_url and scope are absolute to the current frontend origin
          if (data.start_url && !data.start_url.startsWith('http')) {
            data.start_url = origin + data.start_url;
          }
          if (data.scope && !data.scope.startsWith('http')) {
            data.scope = origin + data.scope;
          }

          // Fix icon URLs
          if (Array.isArray(data.icons)) {
            data.icons = data.icons.map(icon => {
              if (icon.src) {
                if (icon.src.startsWith('/')) {
                  // Relative paths for icons should point to the frontend origin
                  icon.src = `${origin}${icon.src}`;
                } else if (icon.src.includes('/api/pwa/logo/') || icon.src.includes('/uploads/')) {
                  // Rewrite backend absolute URLs to same-origin URLs relative to the frontend domain
                  const pathIndex = icon.src.indexOf('/api/pwa/logo/') !== -1 
                    ? icon.src.indexOf('/api/pwa/logo/') 
                    : icon.src.indexOf('/uploads/');
                  const pathWithQuery = icon.src.substring(pathIndex);
                  icon.src = `${origin}/${pathWithQuery.replace(/^\/+/, '')}`;
                }
              }
              return icon;
            });
          }

          return new Response(JSON.stringify(data), {
            headers: {
              'Content-Type': 'application/manifest+json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          });
        })
        .catch(() => caches.match('/site.webmanifest'))
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

  const apiOrigin = getApiOrigin(self.location.hostname);
  if (icon.startsWith('/uploads/')) icon = apiOrigin + icon;
  else if (icon.startsWith('/')) icon = self.location.origin + icon;

  if (badge.startsWith('/uploads/')) badge = apiOrigin + badge;
  else if (badge.startsWith('/')) badge = self.location.origin + badge;

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
