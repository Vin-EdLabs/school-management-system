import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { query } from '../db/connection.js';

const router = express.Router();

// Public endpoint to serve the decoded base64 logo as binary image data
router.get('/logo/:tenantId', async (req, res) => {
  try {
    // Add CORS headers to allow frontend access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

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

      // Set cache headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('Content-Type', contentType);
      return res.send(buffer);
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

const PWA_ICON_SIZES = ['128x128', '192x192', '256x256', '512x512'] as const;

function pageOrigin(req: TenantRequest, clientHost: string): string {
  const protocol = req.protocol || 'https';
  const host = (isTenantSubdomainHost(clientHost) ? clientHost : req.get('host') || clientHost)
    .split(':')[0];
  return `${protocol}://${host}`;
}

function buildManifestIcons(
  pageOriginUrl: string,
  hasTenantLogo: boolean,
  fallbackIcon192: string,
  fallbackIcon512: string,
) {
  if (!hasTenantLogo) {
    return [
      { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
  }

  const icon192 = `${pageOriginUrl}/pwa-icon-192.png`;
  const icon512 = `${pageOriginUrl}/pwa-icon-512.png`;
  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = [];

  for (const size of PWA_ICON_SIZES) {
    const src = size === '512x512' ? icon512 : icon192;
    icons.push({ src, sizes: size, type: 'image/png', purpose: 'any' });
  }

  icons.push(
    { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  );

  return icons;
}

async function resolveTenantLogoUrl(tenantId: number | null): Promise<string | null> {
  if (!tenantId) return null;
  const result = await query(
    `SELECT COALESCE(ss.logo_url, t.logo_url) AS logo_url
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId],
  );
  return result.rows[0]?.logo_url || null;
}

function fallbackIconPath(size: number): string {
  return size >= 256 ? '/android-chrome-512x512.png' : '/android-chrome-192x192.png';
}

// Public route: serve tenant logo as a resized/compressed PNG (PWA + favicon friendly)
router.get('/logo', async (req: TenantRequest, res) => {
  try {
    const size = parseIconSize(req.originalUrl || req.url || req.path, req.query.size as string | undefined);
    const tenantLogo =
      req.tenant?.logo_url ||
      (req.tenantId ? await resolveTenantLogoUrl(req.tenantId) : null);

    if (!tenantLogo) {
      return res.redirect(fallbackIconPath(size));
    }

    const source = await loadLogoBuffer(tenantLogo);
    if (!source) {
      return res.redirect(fallbackIconPath(size));
    }

    const png = await renderLogoPng(source, size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(png);
  } catch (error) {
    console.error('PWA logo error:', error);
    const size = parseIconSize(req.path, req.query.size as string | undefined);
    return res.redirect(fallbackIconPath(size));
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
      // If it's a base64 string, point to the dynamic logo endpoint with absolute URL
      if (logo.startsWith('data:')) {
        const apiHost = req.get('host');
        const protocol = req.protocol;
        // Ensure we use the API host, not the tenant subdomain for logo requests
        // Strip trailing /api to get the base API origin
        const apiBaseUrl = (process.env.API_BASE_URL || `${protocol}://${apiHost}`).replace(/\/api$/, '');
        return `${apiBaseUrl}/api/pwa/logo/${tenantId}`;
      }
      if (logo.startsWith('http')) return logo;
      // For subdomain architecture, serve logos from CDN or API
      if (process.env.CDN_DOMAIN) {
        return `https://${process.env.CDN_DOMAIN}${logo.startsWith('/') ? '' : '/'}${logo}`;
      }
      // Fallback to the current API request origin
      const apiHost = req.get('host');
      const protocol = req.protocol;
      return `${protocol}://${apiHost}${logo.startsWith('/') ? '' : '/'}${logo}`;
    })();

    const fallbackIcon192 = '/android-chrome-192x192.png';
    const fallbackIcon512 = '/android-chrome-512x512.png';

    // 🚀 FIX 1: Explicitly identify as image/webp since your DB saves images in webp format
    const logoMime = 'image/webp';

    // 🚀 FIX 2: Split your logo path into separate parameters for matching dimensions
    // This stops Android from rejecting a 192px source mapped into a 512px wrapper.
    const logoUrl192 = absLogo ? `${absLogo}&size=192` : '';
    const logoUrl512 = absLogo ? `${absLogo}&size=512` : '';

    const tenantIcons = absLogo ? [
      { src: logoUrl192, sizes: '192x192', type: logoMime, purpose: 'any' },
      { src: logoUrl192, sizes: '192x192', type: logoMime, purpose: 'maskable' },
      { src: logoUrl512, sizes: '512x512', type: logoMime, purpose: 'any' },
      { src: logoUrl512, sizes: '512x512', type: logoMime, purpose: 'maskable' },
    ] : [];

    // Base description mapping logic
    let description = `${baseName} parent portal`;
    if (kind === 'school') {
      description = `${baseName} staff and teacher portal`;
    } else if (kind === 'super-admin') {
      description = `${baseName} super admin dashboard`;
    }

    // Construct the standard clean PWA manifest configuration payload
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
          name: kind === 'school' ? 'Open school app' : kind === 'super-admin' ? 'Open super admin' : 'Open parent portal',
          short_name: kind === 'school' ? 'School' : kind === 'super-admin' ? 'Admin' : 'Portal',
          url: startUrl,
        }
      ]
    };

    // Conditional push notification integration check
    const responseManifest = process.env.VAPID_PUBLIC_KEY
      ? { ...manifest, gcm_sender_id: "103953800507" }
      : manifest;

    console.log(`[PWA] Generated manifest for tenant ${subdomain || tenantId}: start_url=${startUrl}, scope=${scope}`);

    // Set correct PWA specification headers and send response
    return res
      .type('application/manifest+json')
      .json(responseManifest);

  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;
