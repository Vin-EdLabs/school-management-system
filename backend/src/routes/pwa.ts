import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { query } from '../db/connection.js';

const router = express.Router();

// Public endpoint to serve the decoded base64 logo as binary image data
router.get('/logo/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (isNaN(tenantId)) {
      return res.status(400).send('Invalid tenant ID');
    }

    const result = await query(
      `SELECT COALESCE(ss.logo_url, t.logo_url) as logo_url
       FROM tenants t
       LEFT JOIN school_settings ss ON ss.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId]
    );

    const logo = result.rows[0]?.logo_url;
    if (!logo) {
      return res.status(404).send('Logo not found');
    }

    if (logo.startsWith('data:')) {
      const matches = logo.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(500).send('Invalid logo format');
      }
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.type(contentType).send(buffer);
    } else {
      if (logo.startsWith('http')) {
        return res.redirect(logo);
      }
      const origin = `${req.protocol}://${req.get('host')}`;
      return res.redirect(`${origin}${logo.startsWith('/') ? '' : '/'}${logo}`);
    }
  } catch (error) {
    console.error('Failed to serve tenant logo:', error);
    return res.status(500).send('Server error');
  }
});

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
    const subdomain = tenant?.subdomain || tenant?.slug || null;
    const tenantId = Number(tenant?.id || 0);
    let logo = tenant?.logo_url || '';
    if (tenantId > 0) {
      const logoRes = await query(
        `SELECT COALESCE(ss.logo_url, t.logo_url) as logo_url
         FROM tenants t
         LEFT JOIN school_settings ss ON ss.tenant_id = t.id
         WHERE t.id = $1`,
        [tenantId]
      ).catch(() => null);
      if (logoRes && logoRes.rows.length > 0 && logoRes.rows[0].logo_url) {
        logo = logoRes.rows[0].logo_url;
      }
    }

    // CRITICAL: Determine the correct origin for this tenant
    // For subdomain architecture, use the tenant's subdomain
    let origin = `${req.protocol}://${req.get('host')}`;
    let baseUrl = origin;
    let appPath = '/portal'; // Default path for parent portal

    // Determine app path based on kind
    if (kind === 'school') {
      appPath = '/';
    } else if (kind === 'super-admin') {
      appPath = '/super-admin';
    } else {
      appPath = '/portal';
    }

    // For subdomain-based tenants, ensure we're using the correct subdomain
    // If the request came to api.scholarnerve.com, we need to construct the tenant URL
    const isApiDomain = req.get('host')?.includes('api.scholarnerve.com') ||
      req.get('host')?.includes('api.scholarnerve.onrender.com') ||
      req.get('host')?.includes('scholarnerve.com'); // Support direct main domain requests

    if (isApiDomain && subdomain) {
      // Build the correct tenant subdomain URL
      const mainDomain = process.env.MAIN_DOMAIN || 'scholarnerve.com';
      origin = `${req.protocol}://${subdomain}.${mainDomain}`;
      baseUrl = origin;
    }

    // Construct start_url - MUST be an absolute URL or root-relative path within scope
    let startUrl: string;
    if (kind === 'super-admin') {
      startUrl = `${baseUrl}/super-admin`;
    } else if (subdomain) {
      // Subdomain architecture: start at the root of the tenant subdomain with appropriate path
      startUrl = `${baseUrl}${appPath}`;
    } else if (tenantId > 0) {
      // Legacy path-based architecture fallback
      startUrl = kind === 'school' ? `/school/${tenantId}` : `/portal/${tenantId}`;
    } else {
      startUrl = appPath;
    }

    // Scope should be limited to the app's directory
    let scope: string;
    if (kind === 'super-admin') {
      scope = `${baseUrl}/super-admin/`;
    } else if (subdomain) {
      // Scope to the specific path on the subdomain
      scope = `${baseUrl}${appPath}/`;
    } else {
      scope = appPath === '/' ? '/' : `${appPath}/`;
    }

    // Ensure trailing slashes for scope
    if (!scope.endsWith('/')) scope += '/';

    const absLogo = (() => {
      if (!logo) return '';
      // If it's a base64 string, point to the dynamic logo endpoint
      if (logo.startsWith('data:')) {
        return `${req.protocol}://${req.get('host')}/api/pwa/logo/${tenantId}`;
      }
      if (logo.startsWith('http')) return logo;
      // For subdomain architecture, serve logos from CDN or API
      if (process.env.CDN_DOMAIN) {
        return `https://${process.env.CDN_DOMAIN}${logo.startsWith('/') ? '' : '/'}${logo}`;
      }
      // Fallback to the current API request origin (e.g., https://scholarnerve.com)
      return `${req.protocol}://${req.get('host')}${logo.startsWith('/') ? '' : '/'}${logo}`;
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

    let description = `${baseName} parent portal`;
    if (kind === 'school') {
      description = `${baseName} staff and teacher portal`;
    } else if (kind === 'super-admin') {
      description = `${baseName} super admin dashboard`;
    }

    const manifest = {
      id: startUrl,
      name: appName,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope: scope,
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait',
      background_color: primary,
      theme_color: secondary,
      categories: ['education', 'productivity'],
      prefer_related_applications: false,
      icons: tenantIcons.length > 0 ? tenantIcons : [
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
      ]
    };

    // Only add gcm_sender_id for push notifications if needed
    const responseManifest = process.env.VAPID_PUBLIC_KEY
      ? { ...manifest, gcm_sender_id: "103953800507" }
      : manifest;

    console.log(`[PWA] Generated manifest for tenant ${subdomain || tenantId}: start_url=${startUrl}, scope=${scope}`);

    return res
      .type('application/manifest+json')
      .json(responseManifest);
  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;