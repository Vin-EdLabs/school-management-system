import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import {
  isTenantSubdomainHost,
  resolveClientHost,
  resolvePwaKind,
} from '../utils/tenantHost.js';

const router = express.Router();

router.use(resolveTenant);

const PWA_ICON_SIZES = ['128x128', '192x192', '256x256', '512x512'] as const;

function buildManifestIcons(
  origin: string,
  logoEndpointUrl: string | null,
  logoMime: string,
  fallbackIcon192: string,
  fallbackIcon512: string,
) {
  if (!logoEndpointUrl) {
    return [
      { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
  }

  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = [];
  for (const size of PWA_ICON_SIZES) {
    icons.push({ src: logoEndpointUrl, sizes: size, type: logoMime, purpose: 'any' });
  }
  icons.push(
    { src: logoEndpointUrl, sizes: '192x192', type: logoMime, purpose: 'maskable' },
    { src: logoEndpointUrl, sizes: '512x512', type: logoMime, purpose: 'maskable' },
  );
  return icons;
}

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
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }

    if (logo.startsWith('http')) {
      return res.redirect(logo);
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const fullUrl = `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`;
    return res.redirect(fullUrl);
  } catch (error) {
    console.error('PWA logo error:', error);
    return res.status(500).send('Internal server error');
  }
});

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const clientHost = resolveClientHost(req);
    const isTenantSubdomain = isTenantSubdomainHost(clientHost);

    const kindQuery = req.query.kind ? String(req.query.kind).toLowerCase() : null;
    const kind = resolvePwaKind(req, clientHost, kindQuery);

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

    let startUrl = '/';
    let scope = '/';

    if (kind === 'super-admin') {
      startUrl = '/super-admin';
      scope = '/super-admin';
    } else if (tenantId > 0) {
      if (isTenantSubdomain) {
        if (kind === 'parent') {
          startUrl = '/portal';
          scope = '/portal';
        } else {
          startUrl = '/';
          scope = '/';
        }
      } else if (kind === 'parent') {
        startUrl = `/portal/${tenantId}`;
        scope = `/portal/${tenantId}`;
      } else {
        startUrl = `/school/${tenantId}`;
        scope = `/school/${tenantId}`;
      }
    }

    const fallbackIcon192 = `${origin}/android-chrome-192x192.png`;
    const fallbackIcon512 = `${origin}/android-chrome-512x512.png`;
    const logoMime = (() => {
      if (logo?.startsWith('data:')) return logo.split(';')[0].split(':')[1] || 'image/png';
      const lower = logo.toLowerCase();
      if (lower.endsWith('.svg')) return 'image/svg+xml';
      if (lower.endsWith('.webp')) return 'image/webp';
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
      return 'image/png';
    })();

    const logoParams = new URLSearchParams();
    if (tenant?.slug) {
      logoParams.set('slug', tenant.slug);
    } else if (req.query.tenantId) {
      logoParams.set('tenantId', String(req.query.tenantId));
    } else if (req.query.slug) {
      logoParams.set('slug', String(req.query.slug));
    }
    if (req.query.host) {
      logoParams.set('host', String(req.query.host));
    }

    const logoQueryStr = logoParams.toString() ? `?${logoParams.toString()}` : '';
    const logoEndpointUrl = tenant?.logo_url ? `${origin}/api/pwa/logo${logoQueryStr}` : null;
    const icons = buildManifestIcons(origin, logoEndpointUrl, logoMime, fallbackIcon192, fallbackIcon512);

    let description = `${baseName} parent portal`;
    if (kind === 'school') {
      description = `${baseName} staff and teacher portal`;
    } else if (kind === 'super-admin') {
      description = `${baseName} super admin dashboard`;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res
      .type('application/manifest+json')
      .json({
        id: startUrl,
        name: appName,
        short_name: shortName,
        description,
        start_url: startUrl,
        scope,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
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
        gcm_sender_id: '103953800507',
      });
  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;
