import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';

const router = express.Router();

router.use(resolveTenant);

// Public route to serve the tenant logo as a standard binary image file (CORS/WebAPK-friendly)
router.get('/logo', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    if (!tenant || !tenant.logo_url) {
      return res.redirect('/android-chrome-192x192.png');
    }

    const logo = tenant.logo_url;
    if (logo.startsWith('data:')) {
      const matches = logo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).send('Invalid logo format');
      }
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      return res.send(buffer);
    } else if (logo.startsWith('http')) {
      return res.redirect(logo);
    } else {
      const origin = `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`;
      return res.redirect(fullUrl);
    }
  } catch (error) {
    console.error('PWA logo error:', error);
    return res.status(500).send('Internal server error');
  }
});

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    
    // Parse Referer header to dynamically detect kind fallback (for initial manifest fetches without query params)
    let kind = 'school';
    const refererHeader = req.headers.referer;
    if (refererHeader) {
      try {
        const refUrl = new URL(refererHeader);
        if (refUrl.pathname.startsWith('/super-admin')) {
          kind = 'super-admin';
        } else if (refUrl.pathname.startsWith('/portal')) {
          kind = 'parent';
        } else if (refUrl.pathname.startsWith('/school') || refUrl.pathname.startsWith('/sch')) {
          kind = 'school';
        }
      } catch (e) {
        // Ignore invalid URL parsing issues
      }
    }

    // Explicit query parameter overrides Referer detection
    const kindQuery = req.query.kind ? String(req.query.kind).toLowerCase() : null;
    if (kindQuery === 'school') {
      kind = 'school';
    } else if (kindQuery === 'super-admin') {
      kind = 'super-admin';
    } else if (kindQuery === 'parent') {
      kind = 'parent';
    }

    const baseName = tenant?.name || 'ScholarNerve';
    
    let appName = `${baseName} — Parent Portal`;
    if (kind === 'school') {
      appName = `${baseName} — School`;
    } else if (kind === 'super-admin') {
      appName = `${baseName} — Super Admin`;
    }
    
    const shortName = baseName.slice(0, 12);
    const primary = tenant?.primary_color || '#0f766e';
    const secondary = tenant?.secondary_color || primary;
    const logo = tenant?.logo_url || '';
    const tenantId = Number(tenant?.id || 0);

    const origin = `${req.protocol}://${req.get('host')}`;

    // Helper to determine if we are on a tenant subdomain (e.g. rosa.scholarnerve.com)
    const host = req.hostname ? req.hostname.toLowerCase() : '';
    const parts = host.split('.');
    const isTenantSubdomain = (() => {
      if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
      if (host.endsWith('.localhost') && parts.length >= 2) {
        return !['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal', 'school'].includes(parts[0]);
      }
      if (host.endsWith('.lvh.me') && parts.length >= 3) {
        return !['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal', 'school'].includes(parts[0]);
      }
      const excludedDomains = [
        'scholarnerve.com',
        'scholarnerve.onrender.com',
        'school-management-system.onrender.com'
      ];
      if (excludedDomains.includes(host)) return false;
      const reservedSubdomains = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal', 'school'];
      if (reservedSubdomains.includes(parts[0])) return false;
      if (host.endsWith('.onrender.com')) {
        return parts.length >= 4;
      }
      return parts.length >= 3;
    })();

    // Compute correct start URL based on domain style and kind
    let startUrl = '/';
    if (kind === 'super-admin') {
      startUrl = '/super-admin';
    } else if (tenantId > 0) {
      if (isTenantSubdomain) {
        startUrl = kind === 'school' ? '/' : '/portal';
      } else {
        startUrl = kind === 'school' ? `/school/${tenantId}` : `/portal/${tenantId}`;
      }
    }

    const fallbackIcon192 = '/android-chrome-192x192.png';
    const fallbackIcon512 = '/android-chrome-512x512.png';
    const logoMime = (() => {
      if (logo?.startsWith('data:')) return logo.split(';')[0].split(':')[1] || 'image/png';
      const lower = logo.toLowerCase();
      if (lower.endsWith('.svg')) return 'image/svg+xml';
      if (lower.endsWith('.webp')) return 'image/webp';
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
      return 'image/png';
    })();

    // Build path to our new PWA logo route, passing down tenant identifier query parameters
    const logoParams = new URLSearchParams();
    if (req.query.tenantId) {
      logoParams.set('tenantId', String(req.query.tenantId));
    }
    if (req.query.slug) {
      logoParams.set('slug', String(req.query.slug));
    }
    const logoQueryStr = logoParams.toString() ? `?${logoParams.toString()}` : '';
    const logoEndpointUrl = `/api/pwa/logo${logoQueryStr}`;

    const tenantIcons = tenant?.logo_url
      ? [
          { src: logoEndpointUrl, sizes: '192x192', type: logoMime, purpose: 'any' },
          { src: logoEndpointUrl, sizes: '192x192', type: logoMime, purpose: 'maskable' },
          { src: logoEndpointUrl, sizes: '512x512', type: logoMime, purpose: 'any' },
          { src: logoEndpointUrl, sizes: '512x512', type: logoMime, purpose: 'maskable' },
        ]
      : [];

    const icons = tenantIcons.length > 0
      ? tenantIcons
      : [
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ];

    let description = `${baseName} parent portal`;
    if (kind === 'school') {
      description = `${baseName} staff and teacher portal`;
    } else if (kind === 'super-admin') {
      description = `${baseName} super admin dashboard`;
    }

    return res
      .type('application/manifest+json')
      .json({
        id: startUrl,
        name: appName,
        short_name: shortName,
        description,
        start_url: startUrl,
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: primary,
        theme_color: secondary,
        categories: ['education', 'productivity'],
        prefer_related_applications: false,
        icons,
        shortcuts: [
          {
            name: kind === 'school'
              ? 'Open school app'
              : kind === 'super-admin'
                ? 'Open super admin'
                : 'Open parent portal',
            short_name: kind === 'school'
              ? 'School'
              : kind === 'super-admin'
                ? 'Admin'
                : 'Portal',
            url: startUrl,
          }
        ],
        gcm_sender_id: "103953800507"
      });
  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;

