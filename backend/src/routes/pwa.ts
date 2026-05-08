import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';

const router = express.Router();

router.use(resolveTenant);

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const appName = tenant?.name || 'ScholarNerve Parent Portal';
    const shortName = (tenant?.name || 'ScholarNerve').slice(0, 12);
    const primary = tenant?.primary_color || '#0f766e';
    const secondary = tenant?.secondary_color || primary;
    const subdomain = tenant?.subdomain || tenant?.slug || 'default';
    const logo = tenant?.logo_url || '';
    const tenantId = Number(tenant?.id || 0);

    const origin = `${req.protocol}://${req.get('host')}`;
    const icon192 = logo ? (logo.startsWith('data:') ? logo : `${origin}${logo}`) : `/school-assets/${subdomain}/logo-192.png`;
    const icon512 = logo ? (logo.startsWith('data:') ? logo : `${origin}${logo}`) : `/school-assets/${subdomain}/logo-512.png`;
    const logoMime = logo?.startsWith('data:') ? logo.split(';')[0].split(':')[1] : 'image/png';
    const startUrl = tenantId > 0 ? `/portal/${tenantId}` : '/';

    return res
      .type('application/manifest+json')
      .json({
        id: startUrl,
        name: appName,
        short_name: shortName,
        description: `${appName} Parent Portal`,
        start_url: startUrl,
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: primary,
        theme_color: secondary,
        categories: ['education', 'productivity'],
        icons: [
          { src: icon192, sizes: '192x192', type: logoMime, purpose: 'any' },
          { src: icon192, sizes: '192x192', type: logoMime, purpose: 'maskable' },
          { src: icon512, sizes: '512x512', type: logoMime, purpose: 'any' },
          { src: icon512, sizes: '512x512', type: logoMime, purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'Open Parent Portal',
            short_name: 'Portal',
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

