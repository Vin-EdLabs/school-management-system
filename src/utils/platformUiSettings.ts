export type PlatformUiSettings = {
  zoomNudgeEnabled: boolean;
};

const CACHE_KEY = 'scholarnerve-platform-ui-v1';

export function readCachedPlatformUi(): PlatformUiSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { zoomNudgeEnabled?: unknown };
    return { zoomNudgeEnabled: parsed.zoomNudgeEnabled === true };
  } catch {
    return null;
  }
}

export function writeCachedPlatformUi(ui: PlatformUiSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ zoomNudgeEnabled: ui.zoomNudgeEnabled === true }));
  } catch {
    /* ignore quota */
  }
}

export async function fetchPublicPlatformUi(baseUrl: string): Promise<PlatformUiSettings> {
  const response = await fetch(`${baseUrl}/system/public-ui-config`, { cache: 'no-store' });
  const data = (await response.json().catch(() => ({}))) as { ui?: { zoomNudgeEnabled?: unknown } };
  if (!response.ok) {
    throw new Error('Failed to load platform UI settings');
  }
  return { zoomNudgeEnabled: data?.ui?.zoomNudgeEnabled === true };
}
