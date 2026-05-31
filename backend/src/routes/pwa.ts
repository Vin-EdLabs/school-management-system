import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';

const router = express.Router();

router.use(resolveTenant);

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const kind = String(req.query.kind || 'parent').toLowerCase() === 'school' ? 'school' : 'parent';
    const baseName = tenant?.name || 'ScholarNerve';
    const appName =
      kind === 'school' ? `${baseName} — School` : `${baseName} — Parent Portal`;
    const shortName = baseName.slice(0, 12);
    const primary = tenant?.primary_color || '#0f766e';
    const secondary = tenant?.secondary_color || primary;
    const subdomain = tenant?.subdomain || tenant?.slug || 'default';
    const logo = tenant?.logo_url || '';
    const tenantId = Number(tenant?.id || 0);

    const origin = `${req.protocol}://${req.get('host')}`;
    const absLogo = (() => {
      if (!logo) return '';
      if (logo.startsWith('data:') || logo.startsWith('http')) return logo;
      return `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`;
    })();
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
    const tenantIcons = absLogo
      ? [
          { src: absLogo, sizes: '192x192', type: logoMime, purpose: 'any' },
          { src: absLogo, sizes: '192x192', type: logoMime, purpose: 'maskable' },
          { src: absLogo, sizes: '512x512', type: logoMime, purpose: 'any' },
          { src: absLogo, sizes: '512x512', type: logoMime, purpose: 'maskable' },
        ]
      : [];

    let startUrl = '/';
    if (tenantId > 0) {
      if (kind === 'school') {
        const slug = tenant?.slug || tenant?.subdomain;
        startUrl = slug ? `/sch/${String(slug).replace(/^\/+|\/+$/g, '')}` : `/school/${tenantId}`;
      } else {
        startUrl = `/portal/${tenantId}`;
      }
    }

    const description =
      kind === 'school' ? `${baseName} staff and teacher portal` : `${baseName} parent portal`;

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
        icons: [
          ...tenantIcons,
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: kind === 'school' ? 'Open school app' : 'Open parent portal',
            short_name: kind === 'school' ? 'School' : 'Portal',
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

