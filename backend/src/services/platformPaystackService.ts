import { encryptField, decryptField } from '../utils/fieldEncryption.js';
import { query } from '../db/connection.js';

const PAYSTACK_KEY = 'paystack';

export type PlatformPaystackSettings = {
  useLiveKeys: boolean;
  testPublicKey: string | null;
  livePublicKey: string | null;
  hasTestSecret: boolean;
  hasLiveSecret: boolean;
  /** True when the displayed test public key comes from PAYSTACK_PUBLIC_KEY in .env */
  testPublicKeyFromEnv?: boolean;
  /** True when test secret is available only from PAYSTACK_SECRET_KEY in .env */
  testSecretFromEnv?: boolean;
  /** Prefill for super-admin UI when secret is not stored in platform_settings */
  envTestSecretKey?: string | null;
};

type StoredPaystackSettings = {
  useLiveKeys?: boolean;
  testPublicKey?: string | null;
  livePublicKey?: string | null;
  testSecretKeyEncrypted?: string | null;
  liveSecretKeyEncrypted?: string | null;
};

function envTestKeys(): { publicKey: string | null; secretKey: string | null } {
  return {
    publicKey: process.env.PAYSTACK_PUBLIC_KEY?.trim() || null,
    secretKey: process.env.PAYSTACK_SECRET_KEY?.trim() || null,
  };
}

function parseStored(value: unknown): StoredPaystackSettings {
  return value && typeof value === 'object' ? (value as StoredPaystackSettings) : {};
}

export async function getPlatformPaystackSettings(): Promise<PlatformPaystackSettings> {
  try {
    const res = await query(`SELECT value FROM platform_settings WHERE key = $1`, [PAYSTACK_KEY]);
    const raw = parseStored(res.rows[0]?.value);
    const env = envTestKeys();
    const dbPublic = raw.testPublicKey?.trim() || null;
    const dbHasSecret = Boolean(raw.testSecretKeyEncrypted);
    const testPublicKeyFromEnv = !dbPublic && Boolean(env.publicKey);
    const testSecretFromEnv = !dbHasSecret && Boolean(env.secretKey);

    return {
      useLiveKeys: raw.useLiveKeys === true,
      testPublicKey: dbPublic || env.publicKey,
      livePublicKey: raw.livePublicKey?.trim() || null,
      hasTestSecret: dbHasSecret || Boolean(env.secretKey),
      hasLiveSecret: Boolean(raw.liveSecretKeyEncrypted),
      testPublicKeyFromEnv,
      testSecretFromEnv,
      envTestSecretKey: testSecretFromEnv ? env.secretKey : null,
    };
  } catch {
    const env = envTestKeys();
    return {
      useLiveKeys: false,
      testPublicKey: env.publicKey,
      livePublicKey: null,
      hasTestSecret: Boolean(env.secretKey),
      hasLiveSecret: false,
      testPublicKeyFromEnv: Boolean(env.publicKey),
      testSecretFromEnv: Boolean(env.secretKey),
      envTestSecretKey: env.secretKey,
    };
  }
}

async function loadStored(): Promise<StoredPaystackSettings> {
  const res = await query(`SELECT value FROM platform_settings WHERE key = $1`, [PAYSTACK_KEY]);
  return parseStored(res.rows[0]?.value);
}

export async function updatePlatformPaystackSettings(
  input: {
    useLiveKeys?: boolean;
    testPublicKey?: string | null;
    livePublicKey?: string | null;
    testSecretKey?: string | null;
    liveSecretKey?: string | null;
  },
  updatedBy: number | null
): Promise<PlatformPaystackSettings> {
  const existing = await loadStored();
  const next: StoredPaystackSettings = {
    ...existing,
    useLiveKeys: input.useLiveKeys !== undefined ? Boolean(input.useLiveKeys) : existing.useLiveKeys === true,
    testPublicKey: input.testPublicKey !== undefined ? input.testPublicKey?.trim() || null : existing.testPublicKey ?? null,
    livePublicKey: input.livePublicKey !== undefined ? input.livePublicKey?.trim() || null : existing.livePublicKey ?? null,
  };

  if (input.testSecretKey?.trim()) {
    next.testSecretKeyEncrypted = encryptField(input.testSecretKey.trim());
  }
  if (input.liveSecretKey?.trim()) {
    next.liveSecretKeyEncrypted = encryptField(input.liveSecretKey.trim());
  }

  await query(
    `INSERT INTO platform_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [PAYSTACK_KEY, JSON.stringify(next), updatedBy]
  );

  return getPlatformPaystackSettings();
}

export async function resolvePlatformPaystackKeys(): Promise<{ publicKey: string | null; secretKey: string | null; useLiveKeys: boolean }> {
  const settings = await getPlatformPaystackSettings();
  const stored = await loadStored();
  const env = envTestKeys();

  if (settings.useLiveKeys) {
    const secret = stored.liveSecretKeyEncrypted
      ? decryptField(stored.liveSecretKeyEncrypted)
      : null;
    return {
      useLiveKeys: true,
      publicKey: settings.livePublicKey,
      secretKey: secret,
    };
  }

  const secret = stored.testSecretKeyEncrypted
    ? decryptField(stored.testSecretKeyEncrypted)
    : env.secretKey;
  return {
    useLiveKeys: false,
    publicKey: settings.testPublicKey || env.publicKey,
    secretKey: secret,
  };
}
