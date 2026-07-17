/* ScholarNerve service worker — caching + push. Bump CACHE_VERSION on breaking cache changes. */
const CACHE_VERSION = '2026-07-17-partner-emblem-v1';
const CACHE_NAME = `scholarnerve-app-${CACHE_VERSION}`;
const BRANDING_CACHE = 'scholarnerve-branding-v1';
// Dedicated offline backup cache — never deleted on activate, seeded from both
// the SW and the client so iOS Safari always has an index.html to fall back to.
const OFFLINE_CACHE = 'scholarnerve-offline-v1';
const OFFLINE_INDEX_KEY = 'offline-index-html';
const BRANDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APP_SHELL = ['/', '/index.html'];

const OFFLINE_HTML =
  '<html><body><h2>You are offline</h2><p>Please reconnect and try again.</p></body></html>';
const OFFLINE_HTML_SHORT = '<html><body><h2>You are offline</h2></body></html>';

const TRANSPARENT_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function offlineHtmlResponse(short) {
  return new Response(short ? OFFLINE_HTML_SHORT : OFFLINE_HTML, {
    headers: { 'Content-Type': 'text/html' },
  });
}

function offlineIndexFallback(short) {
  return caches.match('/index.html').then((cached) => cached || offlineHtmlResponse(short));
}

function offlineAssetResponse() {
  return new Response('', { status: 408, statusText: 'Offline' });
}

function nullSafeIndexCatch(promise, short) {
  return promise.catch(() => offlineIndexFallback(short));
}

function transparentPngResponse() {
  const bytes = Uint8Array.from(atob(TRANSPARENT_PNG), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Strategy: try multiple ways to get index.html into cache
      // iOS Safari blocks some fetch() calls during SW install,
      // so we try several fallback approaches.

      // Attempt 1: fetch with no-cache to get a fresh copy
      try {
        const response = await fetch('/index.html', {
          cache: 'no-cache',
          credentials: 'same-origin',
        });
        if (response && response.ok) {
          await cache.put('/index.html', response.clone());
          await cache.put('/', response.clone());
          // Also seed the dedicated offline backup cache
          const offlineCache = await caches.open(OFFLINE_CACHE);
          await offlineCache.put(OFFLINE_INDEX_KEY, response.clone());
          await offlineCache.put('/index.html', response.clone());
          return; // success — done
        }
      } catch (e) {
        console.warn('[SW] Install fetch attempt 1 failed:', e);
      }

      // Attempt 2: fetch with default settings
      try {
        const response = await fetch('/index.html');
        if (response && response.ok) {
          await cache.put('/index.html', response.clone());
          await cache.put('/', response.clone());
          const offlineCache = await caches.open(OFFLINE_CACHE);
          await offlineCache.put(OFFLINE_INDEX_KEY, response.clone());
          await offlineCache.put('/index.html', response.clone());
          return;
        }
      } catch (e) {
        console.warn('[SW] Install fetch attempt 2 failed:', e);
      }

      // Attempt 3: cache.addAll as last resort
      try {
        await cache.addAll(['/index.html', '/']);
      } catch (e) {
        console.warn('[SW] Install cache.addAll failed:', e);
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== CACHE_NAME &&
                k !== BRANDING_CACHE &&
                k !== OFFLINE_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => {
        // Only claim clients on first install, not on every update,
        // to prevent reload storm when connection is restored.
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          if (clients.length === 0) return self.clients.claim();
        });
      })
      .then(() => {
        // Re-verify index.html is in cache after activation
        // This catches cases where iOS blocked the install-time fetch
        return self.clients.matchAll({ type: 'window' }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
          });
        });
      }),
  );
});

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

function isViteDevPath(url) {
  return (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/deps/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.startsWith('/.vite/')
  );
}

function isHashedBuildAsset(url) {
  return (
    url.pathname.startsWith('/assets/') &&
    /\.[a-zA-Z0-9_-]{6,}\.(js|css|mjs)$/i.test(url.pathname)
  );
}

function isStaticAsset(url) {
  if (url.pathname.startsWith('/uploads/')) {
    return false;
  }
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
  if (isHashedBuildAsset(url)) {
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
  return nullSafeIndexCatch(
    fetch(logoUrl)
      .then((response) => {
        if (response && response.ok) return response;
        const fallback =
          url.pathname === '/pwa-icon-512.png'
            ? '/android-chrome-512x512.png'
            : '/android-chrome-192x192.png';
        return fetch(fallback);
      })
      .catch(() => {
        const fallback =
          url.pathname === '/pwa-icon-512.png'
            ? '/android-chrome-512x512.png'
            : '/android-chrome-192x192.png';
        return fetch(fallback);
      }),
    true,
  ).catch(() => transparentPngResponse());
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

function brandingCacheAgeMs(response) {
  const raw = response.headers.get('X-Cached-At');
  if (!raw) return Number.POSITIVE_INFINITY;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Date.now() - ts;
}

function isBrandingCacheFresh(response) {
  return brandingCacheAgeMs(response) <= BRANDING_MAX_AGE_MS;
}

async function readBrandingCached(request) {
  const cache = await caches.open(BRANDING_CACHE);
  return cache.match(request);
}

async function writeBrandingCached(request, response) {
  if (!response || !response.ok) return;
  const headers = new Headers(response.headers);
  headers.set('X-Cached-At', String(Date.now()));
  const body = await response.clone().blob();
  const cached = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  const cache = await caches.open(BRANDING_CACHE);
  await cache.put(request, cached);
}

async function handlePwaLogoRequest(request) {
  try {
    const cached = await readBrandingCached(request);
    if (cached && isBrandingCacheFresh(cached)) {
      return cached;
    }

    try {
      const network = await fetch(request);
      if (network && network.ok) {
        await writeBrandingCached(request, network.clone());
        return network;
      }
    } catch (err) {
      console.warn('[PWA SW] Logo network failed:', err);
    }

    if (cached) return cached;
    return transparentPngResponse();
  } catch {
    return transparentPngResponse();
  }
}

async function buildManifestResponse(apiUrl, params, origin) {
  const response = await fetch(apiUrl, { cache: 'no-store' });
  if (!response || !response.ok) throw new Error('API manifest failed');
  const data = await response.json();
  const apiOrigin = apiUrl.replace(/\/api\/pwa\/manifest.*$/, '');

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
}

async function handlePwaManifestRequest(request, apiUrl, params, origin) {
  try {
    const cached = await readBrandingCached(request);

    const revalidate = buildManifestResponse(apiUrl, params, origin)
      .then(async (fresh) => {
        await writeBrandingCached(request, fresh.clone());
        return fresh;
      })
      .catch((err) => {
        console.error('[PWA SW] Dynamic manifest failed:', err);
        return null;
      });

    if (cached) {
      void revalidate;
      return cached;
    }

    const fresh = await revalidate;
    if (fresh) return fresh;

    const siteManifest = await fetch('/site.webmanifest', { cache: 'no-store' }).catch(() => null);
    if (siteManifest && siteManifest.ok) return siteManifest;

    return new Response('{}', {
      headers: { 'Content-Type': 'application/manifest+json' },
    });
  } catch {
    const cached = await readBrandingCached(request).catch(() => null);
    if (cached) return cached;
    return new Response('{}', {
      headers: { 'Content-Type': 'application/manifest+json' },
    });
  }
}

function guaranteedOfflineResponse() {
  // Layer 4: guaranteed non-null HTML response — Safari will accept this.
  return new Response(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ScholarNerve — Offline</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          min-height: 100vh;
          background: linear-gradient(145deg, #ffffff 0%, #e8f5f0 40%, #0f766e 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: system-ui, -apple-system, sans-serif;
          gap: 16px; padding: 24px;
        }
        .logo {
          width: 80px; height: 80px; border-radius: 16px;
          background: #0f766e;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 28px; font-weight: 700;
        }
        h1 { color: #0f766e; font-size: 20px; font-weight: 600; }
        p { color: #0f766e; opacity: 0.7; font-size: 14px; text-align: center; }
        .retry {
          margin-top: 8px; padding: 10px 24px;
          background: #0f766e; color: white;
          border: none; border-radius: 8px;
          font-size: 14px; font-weight: 600;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="logo">SN</div>
      <h1>ScholarNerve</h1>
      <p>You are offline. Please check your connection and try again.</p>
      <button class="retry" onclick="window.location.reload()">Try again</button>
    </body>
    </html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

async function seedCachesFromNavigationResponse(response) {
  // FIX 1: write every successful navigation response into BOTH the main app
  // cache and the dedicated offline backup cache.
  try {
    const mainClone = response.clone();
    const mainClone2 = response.clone();
    const offlineClone = response.clone();
    const offlineClone2 = response.clone();

    const mainCache = await caches.open(CACHE_NAME);
    await mainCache.put('/index.html', mainClone);
    await mainCache.put('/', mainClone2);

    const offlineCache = await caches.open(OFFLINE_CACHE);
    await offlineCache.put(OFFLINE_INDEX_KEY, offlineClone);
    await offlineCache.put('/index.html', offlineClone2);
  } catch (e) {
    console.warn('[SW] Seeding caches from navigation failed:', e);
  }
}

async function offlineNavigationFallback() {
  // FIX 2: triple-layered offline fallback — never return null or undefined.

  // Layer 1: main app cache
  const layer1 = await caches
    .match('/index.html', { cacheName: CACHE_NAME })
    .catch(() => null);
  if (layer1) return layer1;

  // Layer 2: dedicated offline backup cache
  try {
    const offlineCache = await caches.open(OFFLINE_CACHE);
    const layer2 = await offlineCache.match(OFFLINE_INDEX_KEY).catch(() => null);
    if (layer2) return layer2;
  } catch {
    // keep falling through
  }

  // Layer 3: scan ALL caches for any index.html
  const allCacheKeys = await caches.keys().catch(() => []);
  for (const key of allCacheKeys) {
    try {
      const c = await caches.open(key);
      const match = await c.match('/index.html').catch(() => null);
      if (match) return match;
    } catch {
      // try next cache
    }
  }

  // Layer 4: guaranteed non-null HTML response
  return guaranteedOfflineResponse();
}

async function handleNavigationRequest(event) {
  // Try network first with a 5 second timeout
  const networkWithTimeout = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    fetch(event.request)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });

  try {
    const response = await networkWithTimeout;
    if (response && response.ok) {
      // FIX 1: seed BOTH caches from every successful navigation (background).
      event.waitUntil(seedCachesFromNavigationResponse(response.clone()));
      return response;
    }
    // Non-ok response — fall back through the offline layers
    return await offlineNavigationFallback();
  } catch {
    // Network failed or timed out — fall back through the offline layers
    return await offlineNavigationFallback();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Socket.IO long-polling MUST bypass the service worker. Caching or offline
  // fallbacks here cause net::ERR_FAILED 200 (OK) in production.
  if (isSocketIoRequest(url)) {
    // Socket.IO must never be intercepted — let it fail naturally offline
    // Wrapping in respondWith causes Safari to throw null response errors
    return;
  }

  // Vite dev-server internals (deps, HMR client) must never be cached — stale
  // optimized-dep chunks cause 404s after re-optimization. Always go network.
  if (isViteDevPath(url)) {
    return;
  }

  // Chat photos and other uploads must load from the network (not cached offline stubs).
  if (url.pathname.startsWith('/uploads/')) {
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
    event.respondWith(nullSafeIndexCatch(fetchTenantLogo(url), true).catch(() => transparentPngResponse()));
    return;
  }

  if (url.pathname === '/api/pwa/logo') {
    event.respondWith(
      nullSafeIndexCatch(handlePwaLogoRequest(event.request), true).catch(() => transparentPngResponse()),
    );
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
      nullSafeIndexCatch(
        handlePwaManifestRequest(event.request, apiUrl, params, self.location.origin),
        true,
      ).catch(() =>
        new Response('{}', {
          headers: { 'Content-Type': 'application/manifest+json' },
        }),
      ),
    );
    return;
  }

  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) return response;
          return offlineAssetResponse();
        })
        .catch(() => offlineAssetResponse())
    );
    return;
  }

  if (isNavigationRequest(event.request)) {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  // Vite hashed bundles must be network-first so deploys never mix stale vendor chunks.
  if (isHashedBuildAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
              return response;
            }
            return cached || offlineAssetResponse();
          })
          .catch(() => cached || offlineAssetResponse());
      }).catch(() => offlineAssetResponse())
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
              return response;
            }
            return offlineAssetResponse();
          })
          .catch(() => offlineAssetResponse());
      }).catch(() => offlineAssetResponse())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          }
          return cached || offlineAssetResponse();
        })
        .catch(() => cached || offlineAssetResponse());
      return cached || networkFetch;
    }).catch(() => offlineAssetResponse())
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
  const badgeCountFromPayload = Number(payloadData.unreadCount ?? data.unreadCount ?? NaN);
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (!navigator.setAppBadge) return;
      if (Number.isFinite(badgeCountFromPayload) && badgeCountFromPayload >= 0) {
        if (badgeCountFromPayload > 0) await navigator.setAppBadge(badgeCountFromPayload);
        else if (navigator.clearAppBadge) await navigator.clearAppBadge();
        return;
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'APP_NAV', url: targetUrl });
          client.postMessage({ type: 'SYNC_BADGE' });
          return;
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('notificationclose', () => {
  // Badge count is owned by the app via SET_BADGE_COUNT — do not infer from tray notifications.
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'INVALIDATE_PWA_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
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
    })(),
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
