/* ScholarNerve service worker — caching + push. Bump CACHE_VERSION on breaking cache changes. */
const CACHE_VERSION = '2026-06-10-v14';
const CACHE_NAME = `scholarnerve-app-${CACHE_VERSION}`;
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
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

function isViteDevPath(url) {
  return (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.startsWith('/.vite/')
  );
}

function isStaticAsset(url) {
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/site.webmanifest' ||
    url.pathname.startsWith('/pwa-icon-')
  ) {
    return false;
  }
  if (isViteDevPath(url)) {
    return false;
  }
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

function hasTenantContext(url) {
  return (
    isTenantSubdomainHost(self.location.hostname) ||
    url.search.includes('slug=') ||
    url.search.includes('tenantId=')
  );
}

function buildLogoProxyUrl(url) {
  const apiBase = apiBaseForLocation();
  const params = new URLSearchParams(url.search);
  if (!params.has('host')) {
    params.set('host', self.location.hostname);
  }
  if (url.pathname === '/pwa-icon-512.png') {
    params.set('size', '512');
  } else if (url.pathname === '/pwa-icon-192.png') {
    params.set('size', '192');
  }
  return `${apiBase}/pwa/logo?${params.toString()}`;
}

function fetchTenantLogo(url) {
  const logoUrl = buildLogoProxyUrl(url);
  console.log('[PWA SW] Fetching tenant logo:', logoUrl);
  return fetch(logoUrl)
    .then((response) => {
      if (response.ok) return response;
      console.warn('[PWA SW] Logo proxy failed, using fallback icon');
      const fallback =
        url.pathname === '/pwa-icon-512.png'
          ? '/android-chrome-512x512.png'
          : '/android-chrome-192x192.png';
      return fetch(fallback);
    })
    .catch((err) => {
      console.error('[PWA SW] Logo proxy error:', err);
      const fallback =
        url.pathname === '/pwa-icon-512.png'
          ? '/android-chrome-512x512.png'
          : '/android-chrome-192x192.png';
      return fetch(fallback);
    });
}

function appendIconQueryParams(iconSrc, manifestParams) {
  if (!iconSrc || !manifestParams) return iconSrc;
  try {
    const iconUrl = new URL(iconSrc, self.location.origin);
    if (!iconUrl.pathname.startsWith('/pwa-icon-')) return iconSrc;
    manifestParams.forEach((value, key) => {
      if (!iconUrl.searchParams.has(key)) {
        iconUrl.searchParams.set(key, value);
      }
    });
    return iconUrl.toString();
  } catch {
    return iconSrc;
  }
}

function isSocketIoRequest(url) {
  return url.pathname.startsWith('/socket.io');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Socket.IO long-polling MUST bypass the service worker. Caching or offline
  // fallbacks here cause net::ERR_FAILED 200 (OK) in production.
  if (isSocketIoRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Vite dev-server internals (deps, HMR client) must never be cached — stale
  // optimized-dep chunks cause 404s after re-optimization. Always go network.
  if (isViteDevPath(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isManifestRequest =
    url.pathname === '/manifest.json' ||
    url.pathname === '/site.webmanifest' ||
    url.pathname === '/api/pwa/manifest';

  const isPwaIcon =
    url.pathname === '/pwa-icon-192.png' || url.pathname === '/pwa-icon-512.png';

  if (isPwaIcon || (DYNAMIC_ICON_PATHS.has(url.pathname) && hasTenantContext(url))) {
    event.respondWith(fetchTenantLogo(url));
    return;
  }

  if (isManifestRequest) {
    const apiBase = apiBaseForLocation();
    const params = new URLSearchParams(url.search);
    if (!params.has('host')) {
      params.set('host', self.location.hostname);
    }
    const apiUrl = `${apiBase}/pwa/manifest?${params.toString()}`;

    event.respondWith(
      fetch(apiUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('API manifest failed');
          return response.json();
        })
        .then((data) => {
          console.log('[PWA SW] Dynamic manifest loaded', {
            name: data.name,
            startUrl: data.start_url,
            iconCount: Array.isArray(data.icons) ? data.icons.length : 0,
            firstIcon: data.icons?.[0]?.src,
          });

          const origin = self.location.origin;
          const apiOrigin = apiBase.replace(/\/api$/, '');

          const toAbsolute = (value) => {
            if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
              return origin + value;
            }
            return value;
          };

          if (data.start_url) data.start_url = toAbsolute(data.start_url);
          if (data.scope) data.scope = toAbsolute(data.scope);
          if (data.id) data.id = toAbsolute(data.id);

          if (Array.isArray(data.icons)) {
            data.icons = data.icons.map((icon) => {
              if (icon.src && icon.src.startsWith('/') && !icon.src.startsWith('//')) {
                if (icon.src.startsWith('/uploads/')) {
                  icon.src = apiOrigin + icon.src;
                } else {
                  icon.src = origin + icon.src;
                }
              }
              icon.src = appendIconQueryParams(icon.src, params);
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
        .catch((err) => {
          console.error('[PWA SW] Dynamic manifest failed:', err);
          return fetch('/site.webmanifest', { cache: 'no-store' });
        })
    );
    return;
  }

  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

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
    // Android needs vibrate + high-importance hints to show a heads-up pop-up
    // instead of a silent tray entry.
    vibrate: [200, 100, 200],
    requireInteraction: true,
    renotify: true,
    tag: payloadData.tag || data.tag || `scholarnerve-${Date.now()}`,
    timestamp: Date.now(),
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
  if (data.type === 'INVALIDATE_PWA_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
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

self.addEventListener('error', (event) => {
  const apiBase = apiBaseForLocation();
  fetch(`${apiBase}/system/errors/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: event.message || 'Service worker error',
      stack: event.error?.stack || null,
      source: 'service_worker',
      endpoint: 'sw.js',
      severity: 'critical',
    }),
  }).catch(() => undefined);
});

self.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const apiBase = apiBaseForLocation();
  fetch(`${apiBase}/system/errors/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: reason?.message || String(reason || 'Unhandled SW rejection'),
      stack: reason?.stack || null,
      source: 'service_worker',
      endpoint: 'sw.js',
      severity: 'critical',
    }),
  }).catch(() => undefined);
});
