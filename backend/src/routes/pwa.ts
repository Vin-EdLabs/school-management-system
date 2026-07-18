import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import sharp from 'sharp';

import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { captureSystemError } from '../services/systemErrorService.js';
import {
  isTenantSubdomainHost,
  resolveClientHost,
  resolvePwaKind,
} from '../utils/tenantHost.js';
import { PLATFORM_ADMIN_PATH } from '../constants/platformAdminRoute.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.use(resolveTenant);

const PWA_ICON_SIZES = ['128x128', '192x192', '256x256', '512x512'] as const;

function pageOrigin(req: TenantRequest, clientHost: string): string {
  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // fall through
    }
  }

  const protocol = req.protocol || 'https';
  const forwarded = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwarded) {
    return `${protocol}://${forwarded}`;
  }

  const isLocal =
    clientHost === 'localhost' ||
    clientHost === '127.0.0.1' ||
    clientHost.endsWith('.localhost') ||
    clientHost.endsWith('.lvh.me');
  if (isLocal && protocol === 'http') {
    const devPort = process.env.FRONTEND_DEV_PORT || '8080';
    return `${protocol}://${clientHost}:${devPort}`;
  }

  return `${protocol}://${clientHost}`;
}

function logoVersionKey(logo: string, tenantId: number): string {
  return crypto
    .createHash('sha256')
    .update(`${tenantId}:${logo.length}:${logo.slice(0, 64)}:${logo.slice(-64)}`)
    .digest('hex')
    .slice(0, 12);
}

function buildPwaIconQueryParams(
  req: TenantRequest,
  clientHost: string,
  kind: string,
): string {
  const params = new URLSearchParams();
  const tenant = req.tenant;

  if (tenant?.id) params.set('tenantId', String(tenant.id));
  if (!params.has('tenantId')) {
    const queryTenantId = req.query.tenantId as string;
    if (queryTenantId) params.set('tenantId', queryTenantId);
  }

  if (tenant?.slug) params.set('slug', tenant.slug);
  if (!params.has('slug')) {
    const querySlug = req.query.slug as string;
    if (querySlug) params.set('slug', querySlug);
  }

  params.set('kind', kind);
  params.set('host', clientHost);

  if (tenant?.logo_url) {
    params.set('v', logoVersionKey(tenant.logo_url, tenant.id));
  }

  return params.toString();
}

function buildManifestIcons(
  pageOriginUrl: string,
  iconQuery: string,
  hasTenantLogo: boolean,
  fallbackIcon192: string,
  fallbackIcon512: string,
) {
  if (!hasTenantLogo) {
    const maskable192 = `${pageOriginUrl}/android-chrome-maskable-192x192.png`;
    const maskable512 = `${pageOriginUrl}/android-chrome-maskable-512x512.png`;
    return [
      { src: fallbackIcon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: fallbackIcon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: maskable192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
  }

  // Point icons at the real backend logo endpoint (NOT the virtual /pwa-icon-*.png
  // paths). Android WebAPK minting and iOS fetch these server-side, bypassing the
  // service worker — so they must resolve to a true HTTP resource. The endpoint
  // normalizes every logo into a padded square PNG, so the declared type is png.
  const base = `${pageOriginUrl}/api/pwa/logo?${iconQuery}`;
  const icon192 = `${base}&size=192`;
  const icon512 = `${base}&size=512`;
  const maskable192 = `${base}&size=192&maskable=1`;
  const maskable512 = `${base}&size=512&maskable=1`;
  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = [];

  for (const size of PWA_ICON_SIZES) {
    const src = size === '512x512' ? icon512 : icon192;
    icons.push({ src, sizes: size, type: 'image/png', purpose: 'any' });
  }

  // Maskable variants carry safe-zone padding so Android never crops the logo.
  icons.push(
    { src: maskable192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  );

  return icons;
}

async function readLogoBytes(
  logo: string,
  req: TenantRequest,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (logo.startsWith('data:')) {
    // Parse manually instead of a strict regex: stored data URIs can contain
    // newlines/whitespace in the base64 body (a strict `$`-anchored regex then
    // fails and we'd wrongly fall back to the default icon).
    const comma = logo.indexOf(',');
    if (comma === -1) return null;
    const header = logo.slice(5, comma); // e.g. "image/jpeg;base64"
    const isBase64 = /;base64\s*$/i.test(header);
    const contentType = header.split(';')[0].trim() || 'image/png';
    const dataPart = logo.slice(comma + 1).replace(/\s+/g, '');
    if (!dataPart) return null;
    const buffer = isBase64
      ? Buffer.from(dataPart, 'base64')
      : Buffer.from(decodeURIComponent(dataPart), 'utf-8');
    if (buffer.length === 0) return null;
    return { buffer, contentType };
  }

  if (logo.startsWith('http')) {
    const response = await fetch(logo);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  }

  const relative = logo.startsWith('/') ? logo : `/${logo}`;
  const uploadsRoot = path.join(__dirname, '../../uploads');
  const filePath = relative.startsWith('/uploads/')
    ? path.join(uploadsRoot, relative.replace(/^\/uploads\//, ''))
    : path.join(uploadsRoot, relative.replace(/^\//, ''));

  try {
    const buffer = await fs.readFile(filePath);
    const lower = filePath.toLowerCase();
    let contentType = 'image/png';
    if (lower.endsWith('.svg')) contentType = 'image/svg+xml';
    else if (lower.endsWith('.webp')) contentType = 'image/webp';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
    return { buffer, contentType };
  } catch {
    const origin = `${req.protocol}://${req.get('host')}`;
    const remote = await fetch(`${origin}${relative}`);
    if (!remote.ok) return null;
    const contentType = remote.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await remote.arrayBuffer());
    return { buffer, contentType };
  }
}

/**
 * Normalize an arbitrary logo into a square PNG icon for PWA home-screen install.
 * - Trims outer whitespace / frame borders from the source first.
 * - Uses a clean white canvas so icons fill the launcher shape instead of a tiny
 *   logo floating inside a visible box.
 * - `any`: logo fills ~88% of canvas (minimal padding).
 * - `maskable`: safe-zone padding for Android adaptive icons (~80% visible area).
 */
async function renderIcon(
  buffer: Buffer,
  size: number,
  maskable: boolean,
  background: string,
): Promise<Buffer> {
  const padRatio = maskable ? 0.1 : 0.06;
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);

  let trimmed = buffer;
  try {
    trimmed = await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .trim({ threshold: 18 })
      .png()
      .toBuffer();
  } catch {
    // If trim fails (e.g. uniform image), use the original buffer.
  }

  const resized = await sharp(trimmed)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const canvasBg = maskable
    ? hexToRgba(background.startsWith('#') ? background : '#ffffff')
    : { r: 255, g: 255, b: 255, alpha: 1 };

  return sharp({
    create: { width: size, height: size, channels: 4, background: canvasBg },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
  const fallback = { r: 255, g: 255, b: 255, alpha: 1 };
  if (!hex || !hex.startsWith('#')) return fallback;
  const clean = hex.slice(1);
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6) return fallback;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return fallback;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, alpha: 1 };
}

// ---------------------------------------------------------------------------
// Partner Network PWA — official ScholarNerve Partners logo (separate from
// the main ScholarNerve school/tenant logo).
// ---------------------------------------------------------------------------
const PARTNER_LOGO_FILE = path.join(__dirname, '../../assets/partners/scholarnerve-partners-logo.png');
const PARTNER_LOGO_PUBLIC = path.join(__dirname, '../../../public/partners/scholarnerve-partners-logo.png');
const PARTNER_EMBLEM_FILE = path.join(__dirname, '../../assets/partners/scholarnerve-partner-emblem.png');
const PARTNER_EMBLEM_PUBLIC = path.join(__dirname, '../../../public/partners/scholarnerve-partner-emblem.png');

let partnerLogoCache: Buffer | null = null;
let partnerEmblemCache: Buffer | null = null;
let partnerEmblemVersionTag: string | null = null;

async function getPartnerEmblemVersionTag(): Promise<string> {
  if (partnerEmblemVersionTag) return partnerEmblemVersionTag;
  const bytes = await loadPartnerEmblemBytes();
  partnerEmblemVersionTag = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  return partnerEmblemVersionTag;
}

async function loadPartnerLogoBytes(): Promise<Buffer> {
  if (partnerLogoCache) return partnerLogoCache;
  try {
    partnerLogoCache = await fs.readFile(PARTNER_LOGO_FILE);
    return partnerLogoCache;
  } catch {
    try {
      partnerLogoCache = await fs.readFile(PARTNER_LOGO_PUBLIC);
      return partnerLogoCache;
    } catch {
      partnerLogoCache = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      return partnerLogoCache;
    }
  }
}

async function loadPartnerEmblemBytes(): Promise<Buffer> {
  if (partnerEmblemCache) return partnerEmblemCache;
  try {
    partnerEmblemCache = await fs.readFile(PARTNER_EMBLEM_FILE);
    return partnerEmblemCache;
  } catch {
    try {
      partnerEmblemCache = await fs.readFile(PARTNER_EMBLEM_PUBLIC);
      return partnerEmblemCache;
    } catch {
      try {
        partnerEmblemCache = await loadPartnerLogoBytes();
        return partnerEmblemCache;
      } catch {
        partnerEmblemCache = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        );
        return partnerEmblemCache;
      }
    }
  }
}

router.get('/partner-icon', async (req, res) => {
  try {
    const sizeNum = Math.min(1024, Math.max(16, parseInt(String(req.query.size || '192'), 10) || 192));
    const maskable = req.query.maskable === '1';
    const emblemBytes = await loadPartnerEmblemBytes();
    let version = 'default';
    try {
      version = await getPartnerEmblemVersionTag();
    } catch {
      /* use default version tag */
    }

    let png: Buffer;
    try {
      png = await renderIcon(emblemBytes, sizeNum, maskable, '#ffffff');
    } catch (renderErr) {
      console.warn('[PWA] Partner icon render fallback:', (renderErr as Error)?.message);
      png = emblemBytes;
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.setHeader('ETag', `"partner-emblem-${version}-${sizeNum}${maskable ? '-m' : ''}"`);
    return res.send(png);
  } catch (error: any) {
    console.error('[PWA] Partner icon error:', error);
    return res.redirect(302, '/partners/scholarnerve-partner-emblem.png');
  }
});

function isPartnersClientHost(host: string): boolean {
  return host.split('.')[0] === 'partners';
}

function buildPartnerManifest(origin: string, emblemVersion: string) {
  const icon = (size: number, maskable = false) =>
    `${origin}/api/pwa/partner-icon?size=${size}${maskable ? '&maskable=1' : ''}&v=${emblemVersion}`;
  return {
    id: '/',
    name: 'ScholarNerve',
    short_name: 'ScholarNerve',
    description: 'ScholarNerve Partner Network — refer schools, earn monthly commissions.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    capture_links: 'existing-client-navigate',
    launch_handler: { client_mode: 'navigate-existing' },
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#146c43',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    gcm_sender_id: '103953800507',
    icons: [
      { src: icon(128), sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon(256), sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon(192, true), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon(512, true), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Open partner dashboard', short_name: 'Dashboard', url: '/dashboard' },
      { name: 'Refer a school', short_name: 'Refer', url: '/schools' },
    ],
  };
}

router.get('/logo', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const size = String(req.query.size || '192');

    if (!tenant || !tenant.logo_url) {
      console.log('[PWA] Logo fallback — no tenant logo', {
        tenantId: tenant?.id ?? null,
        host: resolveClientHost(req),
      });
      return res.redirect(302, '/android-chrome-192x192.png');
    }

    const logo = tenant.logo_url;
    const version = logoVersionKey(logo, tenant.id);
    const logoData = await readLogoBytes(logo, req);

    if (!logoData) {
      console.warn('[PWA] Logo read failed — using default icon', {
        tenantId: tenant.id,
        logoPreview: logo.slice(0, 80),
      });
      return res.redirect(302, '/android-chrome-192x192.png');
    }

    const sizeNum = size === '512' ? 512 : size === '180' ? 180 : 192;
    const maskable = req.query.maskable === '1';
    const background = tenant.primary_color || '#ffffff';

    let outBuffer = logoData.buffer;
    let outType = logoData.contentType;
    let normalized = false;
    try {
      outBuffer = await renderIcon(logoData.buffer, sizeNum, maskable, background);
      outType = 'image/png';
      normalized = true;
    } catch (normErr: any) {
      console.warn('[PWA] Logo normalization failed — serving raw bytes', {
        tenantId: tenant.id,
        error: normErr?.message,
      });
    }

    const variantTag = `${version}-${sizeNum}${maskable ? '-m' : ''}`;

    console.log('[PWA] Serving tenant logo', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      size: sizeNum,
      maskable,
      normalized,
      version,
      contentType: outType,
      bytes: outBuffer.length,
      host: resolveClientHost(req),
    });

    res.setHeader('Content-Type', outType);
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('ETag', `"${variantTag}"`);
    res.setHeader('X-PWA-Logo-Version', version);
    return res.send(outBuffer);
  } catch (error: any) {
    console.error('[PWA] Logo error:', error);
    captureSystemError({
      message: error?.message || 'PWA logo error',
      stack: error?.stack || null,
      source: 'pwa',
      tenantId: req.tenant?.id ?? null,
      endpoint: '/api/pwa/logo',
      action: 'serve_tenant_logo',
      severity: 'critical',
    }).catch(() => undefined);
    return res.status(500).send('Internal server error');
  }
});

router.get('/manifest', async (req: TenantRequest, res) => {
  try {
    const tenant = req.tenant;
    const clientHost = resolveClientHost(req);
    const isTenantSubdomain = isTenantSubdomainHost(clientHost);

    const kindQuery = req.query.kind ? String(req.query.kind).toLowerCase() : null;

    // Partner Network PWA gets its own standalone manifest.
    if (isPartnersClientHost(clientHost) || kindQuery === 'partners') {
      const partnerOrigin = pageOrigin(req, clientHost);
      let emblemVersion = 'default';
      try {
        emblemVersion = await getPartnerEmblemVersionTag();
      } catch (err) {
        console.warn('[PWA] Partner emblem version fallback:', (err as Error)?.message);
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res
        .type('application/manifest+json')
        .json(buildPartnerManifest(partnerOrigin, emblemVersion));
    }

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

    const origin = pageOrigin(req, clientHost);
    const iconQuery = buildPwaIconQueryParams(req, clientHost, kind);

    let startUrl = '/';
    let scope = '/';

    if (kind === 'super-admin') {
      startUrl = PLATFORM_ADMIN_PATH;
      scope = PLATFORM_ADMIN_PATH;
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
      iconQuery,
      Boolean(tenant?.logo_url),
      fallbackIcon192,
      fallbackIcon512,
    );

    let description = `${baseName} parent portal`;
    if (kind === 'school') {
      description = `${baseName} staff and teacher portal`;
    } else if (kind === 'super-admin') {
      description = `${baseName} super admin dashboard`;
    }

    console.log('[PWA] Manifest generated', {
      tenantId: tenant?.id ?? null,
      tenantName: tenant?.name ?? null,
      kind,
      host: clientHost,
      startUrl,
      scope,
      hasLogo: Boolean(tenant?.logo_url),
      logoVersion: tenant?.logo_url ? logoVersionKey(logo, tenantId) : null,
      icon192: icons[0]?.src ?? null,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.type('application/manifest+json').json({
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
          name:
            kind === 'school'
              ? 'Open school app'
              : kind === 'super-admin'
                ? 'Open super admin'
                : 'Open parent portal',
          short_name:
            kind === 'school' ? 'School' : kind === 'super-admin' ? 'Admin' : 'Portal',
          url: startUrl,
        },
      ],
      gcm_sender_id: '103953800507',
    });
  } catch (error: any) {
    console.error('[PWA] Manifest error:', error);
    const clientHost = resolveClientHost(req);
    const kindQuery = req.query.kind ? String(req.query.kind).toLowerCase() : null;
    if (isPartnersClientHost(clientHost) || kindQuery === 'partners') {
      try {
        const partnerOrigin = pageOrigin(req, clientHost);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res
          .type('application/manifest+json')
          .json(buildPartnerManifest(partnerOrigin, 'fallback'));
      } catch {
        /* fall through */
      }
    }
    captureSystemError({
      message: error?.message || 'PWA manifest error',
      stack: error?.stack || null,
      source: 'pwa',
      tenantId: req.tenant?.id ?? null,
      endpoint: '/api/pwa/manifest',
      action: 'build_manifest',
      severity: 'critical',
    }).catch(() => undefined);
    return res.status(500).json({ error: 'Failed to build manifest' });
  }
});

export default router;
