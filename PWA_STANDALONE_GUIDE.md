# Perfect PWA & Push Notification Guide

This guide outlines the "Golden Standard" for implementing Progressive Web Apps (PWAs) that act as standalone apps (WebAPK) on Android and iOS, with reliable push notifications.

## 1. Branding: Removing the "Chrome" Logo (WebAPK)
To ensure Android generates a "WebAPK" (standalone app) rather than a "Chrome Shortcut," the manifest must satisfy strict requirements.

### The Problem
* Chrome ignores manifests served via `blob:` URLs.
* Chrome ignores `start_url` and `scope` if the manifest is served from a different origin (e.g., your API domain).

### The Solution: Service Worker Interceptor
Proxy the manifest through your own domain so it appears "Same-Origin."

**Frontend (`main.tsx`):**
```javascript
// Link to a local relative path, even if data comes from the API
const manifestUrl = `/manifest.json?slug=${schoolSlug}`;
const link = document.querySelector("link[rel='manifest']");
link.href = manifestUrl;
```

**Service Worker (`sw.js`):**
```javascript
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/manifest.json') {
    const apiBase = 'https://your-api.com/api';
    const apiUrl = `${apiBase}/pwa/manifest${url.search}`;

    event.respondWith(
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          // Force the start_url to be absolute to your frontend
          data.start_url = self.location.origin + (data.start_url || '/');
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/manifest+json' }
          });
        })
    );
  }
});
```

---

## 2. Push Notifications: The 4KB Rule
Both Web Push and Firebase (FCM) have a hard limit of **4,096 bytes** per payload.

### The Golden Rules
1. **No Base64**: Never embed Base64 images in the push payload. They will exceed 4KB and cause the backend to hang or the delivery to fail.
2. **Absolute URLs**: Use full `https://` URLs for icons.
3. **Android PNGs**: Android Chrome often fails to render **SVG** icons in background notifications. Always provide a **PNG** fallback.

**Backend Logic:**
```javascript
if (payload.icon && payload.icon.startsWith('data:')) {
  delete payload.icon; // Remove if Base64 to prevent payload bloat
}
```

---

## 3. The App Badge (Unread Count)
To show a red number on the app icon:
1. Use `navigator.setAppBadge(count)` in the Service Worker.
2. **Warning**: Do not use `self.registration.setAppBadge`, as it is not a standard API.

**Service Worker:**
```javascript
if (navigator.setAppBadge) {
  navigator.setAppBadge(unreadCount);
}
```

---

## 4. CORS Configuration
When the frontend and backend are on different domains (e.g., Render), your backend must be explicit.

**Backend (`index.ts`):**
* **No Wildcards**: You cannot use `origin: '*'` if you use `credentials: 'include'`.
* **Allowed Headers**: You must explicitly allow custom headers like `x-tenant-id`.

```javascript
app.use(cors({
  origin: ['https://your-frontend.com'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));
```

## 5. Troubleshooting Checklist for Android
If you still see the Chrome logo on a notification:
1. **WebAPK failed**: Check the manifest for "Mixed Content" (HTTP vs HTTPS).
2. **Scope error**: Ensure the `start_url` is within the manifest's `scope`.
3. **Hard Refresh**: On Android, you **must** "Clear & Reset" site data in Chrome settings to trigger a new WebAPK generation after making changes.
