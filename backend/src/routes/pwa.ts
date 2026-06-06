import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';

const router = express.Router();

router.use(resolveTenant);

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const kindQuery = String(req.query.kind || 'parent').toLowerCase();
    const kind = kindQuery === 'school' ? 'school' : kindQuery === 'super-admin' ? 'super-admin' : 'parent';
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
    const subdomain = tenant?.subdomain || tenant?.slug || 'default';
    const logo = tenant?.logo_url || '';
    const tenantId = Number(tenant?.id || 0);

    const origin = `${req.protocol}://${req.get('host')}`;
    const absLogo = (() => {
      if (!logo) return '';
      if (logo.startsWith('data:') || logo.startsWith('http')) return logo;
      return `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`;
    })();
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
    const tenantIcons = absLogo
      ? [
          { src: absLogo, sizes: '192x192', type: logoMime, purpose: 'any' },
          { src: absLogo, sizes: '192x192', type: logoMime, purpose: 'maskable' },
          { src: absLogo, sizes: '512x512', type: logoMime, purpose: 'any' },
          { src: absLogo, sizes: '512x512', type: logoMime, purpose: 'maskable' },
        ]
      : [];

    let startUrl = '/';
    if (kind === 'super-admin') {
      startUrl = '/super-admin';
    } else if (tenantId > 0) {
      if (req.query.slug) {
        startUrl = kind === 'school' ? '/' : '/portal';
      } else {
        startUrl = kind === 'school' ? `/school/${tenantId}` : `/portal/${tenantId}`;
      }
    }

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
        icons: [
          ...tenantIcons,
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
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

