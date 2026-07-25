/** Realistic demo portrait photos stored as base64 data URLs. */

const portraitCache = new Map<string, string>();

/** Curated Unsplash portraits — school-age children and teens (not adults). */
const YOUTH_PORTRAITS_MALE = [
  'https://images.unsplash.com/photo-1581956664127-9041a4d2a54f?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1607996799581-9887e513196b?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1566492031773-4fc4c892d08c?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539579156441-021832587d35?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1548377174-085cb2260869?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085366753-028031ec3859?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1488161628813-04466f77279a?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1628007930718-5314118a1b09?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519451241324-844607e46612?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1503919545880-b6593f2f1379?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544717297-6692b6c8c161?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1476703993599-00301689195d?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1596464716127-28d3f2f4f9b4?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1485548610379-ba73e282566d?w=256&h=256&fit=crop&crop=face',
];

const YOUTH_PORTRAITS_FEMALE = [
  'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1596464716127-28d3f2f4f9b4?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1485548610379-ba73e282566d?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519451241324-844607e46612?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1524253482453-3fed8d2acb12?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544717297-6692b6c8c161?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085366753-028031ec3859?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1581956664127-9041a4d2a54f?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1607996799581-9887e513196b?w=256&h=256&fit=crop&crop=face',
];

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Youthful fallback portrait (school-age silhouette, not an adult). */
function generateYouthFallbackPortraitUrl(fullName: string, gender: string, seed: number): string {
  const isFemale = gender.toLowerCase() === 'female';
  const skin = isFemale ? '#f0c9a8' : '#d4a574';
  const hair = ['#1a1a1a', '#3d2314', '#5c3a1e'][Math.abs(seed) % 3];
  const shirt = isFemale ? '#7c3aed' : '#2563eb';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const label = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#e0f2fe"/>
  <rect y="175" width="256" height="81" fill="${shirt}"/>
  <ellipse cx="128" cy="215" rx="65" ry="32" fill="${shirt}"/>
  <ellipse cx="128" cy="118" rx="44" ry="48" fill="${skin}"/>
  <path d="M84 108 C84 72 102 52 128 52 C154 52 172 72 172 108 C172 118 168 128 160 134 L160 124 C160 102 146 88 128 88 C110 88 96 102 96 124 L96 134 C88 128 84 118 84 108 Z" fill="${hair}"/>
  <ellipse cx="112" cy="122" rx="5" ry="6" fill="#1f2937"/>
  <ellipse cx="144" cy="122" rx="5" ry="6" fill="#1f2937"/>
  <path d="M116 148 Q128 156 140 148" stroke="#c2410c" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text x="128" y="248" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#64748b">${escapeXml(label)}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/** Fallback photo-style SVG if network fetch fails (not emoji). */
function generateFallbackPortraitUrl(fullName: string, gender: string, seed: number): string {
  const isFemale = gender.toLowerCase() === 'female';
  const skin = isFemale ? '#e8b896' : '#c68642';
  const hair = ['#1a1a1a', '#3d2314', '#2c1810'][Math.abs(seed) % 3];
  const shirt = isFemale ? '#6366f1' : '#2563eb';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const label = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#e2e8f0"/>
  <rect y="170" width="256" height="86" fill="${shirt}"/>
  <ellipse cx="128" cy="210" rx="72" ry="38" fill="${shirt}"/>
  <ellipse cx="128" cy="108" rx="52" ry="58" fill="${skin}"/>
  <path d="M76 96 C76 58 98 38 128 38 C158 38 180 58 180 96 C180 110 176 122 168 130 L168 118 C168 92 150 76 128 76 C106 76 88 92 88 118 L88 130 C80 122 76 110 76 96 Z" fill="${hair}"/>
  <ellipse cx="108" cy="112" rx="6" ry="8" fill="#1f2937"/>
  <ellipse cx="148" cy="112" rx="6" ry="8" fill="#1f2937"/>
  <path d="M112 142 Q128 152 144 142" stroke="#9a3412" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <text x="128" y="248" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#64748b">${escapeXml(label)}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function fetchPortraitFromUrl(
  url: string,
  cacheKey: string,
  fallback: () => string
): Promise<string> {
  const cached = portraitCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    portraitCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    const fb = fallback();
    portraitCache.set(cacheKey, fb);
    return fb;
  }
}

/**
 * Fetches a school-age student portrait (children/teens — not adults).
 */
export async function fetchDemoStudentPortraitUrl(
  fullName: string,
  gender: string,
  seed: number
): Promise<string> {
  const isFemale = gender.toLowerCase() === 'female';
  const pool = isFemale ? YOUTH_PORTRAITS_FEMALE : YOUTH_PORTRAITS_MALE;
  const index = Math.abs(seed) % pool.length;
  const url = pool[index];
  const cacheKey = `student:${isFemale ? 'f' : 'm'}:${index}`;
  return fetchPortraitFromUrl(url, cacheKey, () =>
    generateYouthFallbackPortraitUrl(fullName, gender, seed)
  );
}

/**
 * Fetches a realistic adult portrait for teachers and staff (randomuser.me).
 */
export async function fetchDemoPortraitUrl(
  fullName: string,
  gender: string,
  seed: number
): Promise<string> {
  const isFemale = gender.toLowerCase() === 'female';
  const folder = isFemale ? 'women' : 'men';
  const index = Math.abs(seed) % 90;
  const cacheKey = `adult:${folder}:${index}`;
  const url = `https://randomuser.me/api/portraits/med/${folder}/${index}.jpg`;
  return fetchPortraitFromUrl(url, cacheKey, () =>
    generateFallbackPortraitUrl(fullName, gender, seed)
  );
}

/** @deprecated Use fetchDemoPortraitUrl */
export function generateDemoPortraitUrl(fullName: string, gender: string, seed: number): string {
  return generateFallbackPortraitUrl(fullName, gender, seed);
}
