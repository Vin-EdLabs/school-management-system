import { query } from '../db/connection.js';

const UI_KEY = 'ui';

export type PlatformUiSettings = {
  zoomNudgeEnabled: boolean;
};

function parseUiSettings(value: unknown): PlatformUiSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    zoomNudgeEnabled: raw.zoomNudgeEnabled === true,
  };
}

export async function getPlatformUiSettings(): Promise<PlatformUiSettings> {
  try {
    const result = await query(`SELECT value FROM platform_settings WHERE key = $1`, [UI_KEY]);
    if (!result.rows[0]?.value) {
      return { zoomNudgeEnabled: true };
    }
    return parseUiSettings(result.rows[0].value);
  } catch {
    return { zoomNudgeEnabled: false };
  }
}

export async function updatePlatformUiSettings(
  patch: Partial<PlatformUiSettings>,
  updatedBy: number | null
): Promise<PlatformUiSettings> {
  const current = await getPlatformUiSettings();
  const next: PlatformUiSettings = {
    zoomNudgeEnabled:
      patch.zoomNudgeEnabled !== undefined ? Boolean(patch.zoomNudgeEnabled) : current.zoomNudgeEnabled,
  };

  await query(
    `INSERT INTO platform_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [UI_KEY, JSON.stringify(next), updatedBy]
  );

  return next;
}
