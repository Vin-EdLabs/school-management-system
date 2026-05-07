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
    const subdomain = tenant?.subdomain || tenant?.slug || 'default';
    const logo = tenant?.logo_url || '';

    const origin = `${req.protocol}://${req.get('host')}`;
    const icon192 = logo ? `${origin}${logo}` : `/school-assets/${subdomain}/logo-192.png`;
    const icon512 = logo ? `${origin}${logo}` : `/school-assets/${subdomain}/logo-512.png`;

    return res
      .type('application/manifest+json')
      .json({
        name: appName,
        short_name: shortName,
        start_url: '/',
        display: 'standalone',
        background_color: primary,
        theme_color: primary,
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png' },
          { src: icon512, sizes: '512x512', type: 'image/png' }
        ]
      });
  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;

