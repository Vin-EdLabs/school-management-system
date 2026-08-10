/** Module ids for all boarding sidebar / dashboard routes. */
export const BOARDING_MODULE_IDS = [
  'boarding-overview',
  'boarding-dormitories',
  'boarding-boarders',
  'boarding-exeats',
  'boarding-rollcall',
  'boarding-feeding',
  'boarding-sickbay',
  'boarding-complaints',
  'boarding-finance',
  'boarding-print',
] as const;

export type BoardingModuleId = (typeof BOARDING_MODULE_IDS)[number];

export const BOARDING_MODULE_URLS: Record<string, string> = {
  'boarding-overview': '/boarding',
  'boarding-dormitories': '/boarding/dormitories',
  'boarding-boarders': '/boarding/boarders',
  'boarding-exeats': '/boarding/exeats',
  'boarding-rollcall': '/boarding/rollcall',
  'boarding-feeding': '/boarding/feeding',
  'boarding-sickbay': '/boarding/sickbay',
  'boarding-complaints': '/boarding/complaints',
  'boarding-finance': '/boarding/finance',
  'boarding-print': '/boarding/print',
};

export function isBoardingModule(module: string): module is BoardingModuleId {
  return (BOARDING_MODULE_IDS as readonly string[]).includes(module);
}

export function isBoardingPath(pathname: string): boolean {
  return /\/boarding(\/|$)/.test(pathname);
}

export function getSchoolPathPrefix(pathname = window.location.pathname): string {
  const match = pathname.match(/^\/school\/[^/]+/);
  return match ? match[0] : '';
}

/** Strip boarding, transport, and finance deep-link segments from a pathname. */
export function stripFeatureSubpaths(pathname: string): string {
  let path = pathname;
  const patterns = [
    /\/boarding(?:\/.*)?$/,
    /\/transport(?:\/.*)?$/,
    /\/finance\/(?:transactions|daily-fees)\/?$/,
  ];
  for (const pattern of patterns) {
    const next = path.replace(pattern, '');
    if (next !== path) {
      path = next || '/';
      break;
    }
  }
  return path || '/';
}

/** Replace /boarding/* URL with dashboard path prefix preserved. */
export function redirectBoardingPathToDashboard(pathname: string): string {
  const boardingMatch = pathname.match(/^(.*)\/boarding(?:\/.*)?$/);
  if (boardingMatch) {
    const prefix = boardingMatch[1] || '';
    return prefix ? `${prefix}/` : '/';
  }
  return pathname.replace(/\/boarding(?:\/.*)?$/, '/') || '/';
}

export function syncBoardingModuleUrl(moduleId: string): void {
  const path = BOARDING_MODULE_URLS[moduleId];
  if (!path) return;
  const prefix = getSchoolPathPrefix();
  window.history.pushState({}, '', `${prefix}${path}`);
}
