import express from 'express';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import {
  isTenantSubdomainHost,
  resolveClientHost,
  resolvePwaKind,
} from '../utils/tenantHost.js';
import {
  loadLogoBuffer,
  parseIconSize,
  renderLogoPng,
} from '../services/logoImageService.js';
import { query } from '../db/connection.js';

const router = express.Router();

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
    const tenantId = Number(tenant?.id || 0);

    const tenantLogo =
      tenant?.logo_url ||
      (tenantId > 0 ? await resolveTenantLogoUrl(tenantId) : null);

    const origin = pageOrigin(req, clientHost);

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

    const icons = buildManifestIcons(
      origin,
      Boolean(tenantLogo),
      fallbackIcon192,
      fallbackIcon512,
    );

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
          },
        ],
        gcm_sender_id: '103953800507',
      });
  } catch (error) {
    console.error('PWA manifest error:', error);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;
