import { query } from '../db/connection.js';

const ARKESEL_BASE_URL = 'https://sms.arkesel.com/api/v2';

export type SmsEventType =
  | 'broadcast'
  | 'payment'
  | 'attendance'
  | 'grades'
  | 'exeats'
  | 'birthdays'
  | 'complaints'
  | 'admissions'
  | 'payroll'
  | 'test';

export type SmsPackage = {
  id: string;
  name: string;
  credits: number;
  priceGhs: number;
  badge?: string;
  description?: string;
  popular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export const DEFAULT_SMS_PACKAGES: SmsPackage[] = [
  { id: 'starter_500', name: 'Starter Pack', credits: 500, priceGhs: 40, description: 'Great for small schools and introductory testing' },
  { id: 'standard_1500', name: 'Standard Pack', credits: 1500, priceGhs: 110, description: 'Ideal for monthly attendance & fee reminder broadcasts' },
  { id: 'term_3500', name: 'Term Bundle', credits: 3500, priceGhs: 240, popular: true, badge: 'Popular', description: 'Recommended for full-term notices and terminal report alerts' },
  { id: 'annual_10000', name: 'Annual Institution Pack', credits: 10000, priceGhs: 650, badge: 'Best Value', description: 'Best value for high-volume, multi-campus institutions' },
];

export const SMS_PACKAGES: SmsPackage[] = DEFAULT_SMS_PACKAGES;

/**
 * Fetches active SMS packages available for school tenants to purchase.
 */
export async function getActiveSmsPackages(): Promise<SmsPackage[]> {
  try {
    const res = await query(
      `SELECT id, name, credits, price_ghs AS "priceGhs", description, popular, is_active AS "isActive", sort_order AS "sortOrder"
       FROM platform_sms_packages
       WHERE is_active = true
       ORDER BY sort_order ASC, credits ASC`
    );
    if (res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        credits: Number(r.credits),
        priceGhs: Number(r.priceGhs),
        description: r.description || '',
        popular: Boolean(r.popular),
        isActive: Boolean(r.isActive),
        sortOrder: Number(r.sortOrder || 0),
        badge: r.popular ? 'Popular' : undefined,
      }));
    }
  } catch (err) {
    console.warn('[arkesel] Using default SMS packages due to query fallback:', err);
  }
  return DEFAULT_SMS_PACKAGES;
}

/**
 * Fetches all SMS packages (including inactive ones) for SuperAdmin pricing management.
 */
export async function getAllSmsPackages(): Promise<SmsPackage[]> {
  try {
    const res = await query(
      `SELECT id, name, credits, price_ghs AS "priceGhs", description, popular, is_active AS "isActive", sort_order AS "sortOrder"
       FROM platform_sms_packages
       ORDER BY sort_order ASC, credits ASC`
    );
    if (res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        credits: Number(r.credits),
        priceGhs: Number(r.priceGhs),
        description: r.description || '',
        popular: Boolean(r.popular),
        isActive: Boolean(r.isActive),
        sortOrder: Number(r.sortOrder || 0),
        badge: r.popular ? 'Popular' : undefined,
      }));
    }
  } catch (err) {
    console.warn('[arkesel] Using default SMS packages for superadmin:', err);
  }
  return DEFAULT_SMS_PACKAGES;
}

/**
 * Saves or updates SMS packages list configured by SuperAdmin.
 */
export async function saveSmsPackages(packages: SmsPackage[]): Promise<SmsPackage[]> {
  for (let i = 0; i < packages.length; i++) {
    const p = packages[i];
    const id = (p.id || `pkg_${p.credits || Date.now()}`).trim();
    const name = (p.name || 'SMS Pack').trim();
    const credits = Math.max(1, Math.floor(Number(p.credits) || 100));
    const priceGhs = Math.max(0.1, Number(p.priceGhs) || 1);
    const description = (p.description || '').trim();
    const popular = Boolean(p.popular);
    const isActive = p.isActive !== false;
    const sortOrder = typeof p.sortOrder === 'number' ? p.sortOrder : i + 1;

    await query(
      `INSERT INTO platform_sms_packages
         (id, name, credits, price_ghs, description, popular, is_active, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         credits = EXCLUDED.credits,
         price_ghs = EXCLUDED.price_ghs,
         description = EXCLUDED.description,
         popular = EXCLUDED.popular,
         is_active = EXCLUDED.is_active,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [id, name, credits, priceGhs, description, popular, isActive, sortOrder]
    );
  }
  return getAllSmsPackages();
}

/**
 * Deletes an SMS package tier by ID.
 */
export async function deleteSmsPackage(packageId: string): Promise<void> {
  await query(`DELETE FROM platform_sms_packages WHERE id = $1`, [packageId]);
}

export function isArkeselConfigured(): boolean {
  return Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_API_KEY.trim().length > 0);
}

export function getMasterArkeselApiKey(): string {
  return (process.env.ARKESEL_API_KEY || '').trim();
}

export function getDefaultSenderId(): string {
  const custom = (process.env.ARKESEL_DEFAULT_SENDER_ID || '').trim();
  return custom ? custom.slice(0, 11) : 'SCHNerve';
}

/**
 * Normalizes phone numbers for SMS gateway (Ghana 233 format or E.164 without leading plus).
 * e.g. '024 123 4567' -> '233241234567'
 *      '+233241234567' -> '233241234567'
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  // Ghana local 10-digit format starting with 0: 02x, 05x, 03x
  if (digits.startsWith('0') && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }

  // Ghana international without plus: 233 + 9 digits = 12 digits
  if (digits.startsWith('233') && digits.length === 12) {
    return digits;
  }

  // Other international numbers (between 9 and 15 digits)
  if (digits.length >= 9 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Calculates SMS segment count based on standard GSM 03.38 vs Unicode encoding.
 */
export function calculateSmsSegments(message: string): { segments: number; isUnicode: boolean; charCount: number } {
  const text = String(message || '');
  const charCount = text.length;
  if (charCount === 0) return { segments: 1, isUnicode: false, charCount: 0 };

  // Detect characters outside standard GSM 7-bit charset
  // eslint-disable-next-line no-control-regex
  const gsmRegex = /^[\u000a\u000d\u0020-\u007e\u00a1\u00a3\u00a4\u00a5\u00a7\u00bf\u00c4\u00c5\u00c6\u00c7\u00c9\u00d1\u00d6\u00d8\u00dc\u00df\u00e0\u00e4\u00e5\u00e6\u00e8\u00e9\u00ec\u00f1\u00f2\u00f6\u00f8\u00f9\u00fc\u0393\u0394\u0398\u039b\u039e\u03a0\u03a3\u03a6\u03a8\u03a9^{}\\[~\]|€]*$/;
  const isUnicode = !gsmRegex.test(text);

  let segments = 1;
  if (!isUnicode) {
    if (charCount <= 160) {
      segments = 1;
    } else {
      segments = Math.ceil(charCount / 153);
    }
  } else {
    if (charCount <= 70) {
      segments = 1;
    } else {
      segments = Math.ceil(charCount / 67);
    }
  }

  return { segments: Math.max(1, segments), isUnicode, charCount };
}

export type TenantSmsWallet = {
  balance: number;
  senderId: string;
  senderIdStatus: 'default' | 'pending' | 'approved' | 'rejected';
  enabled: boolean;
  toggles: {
    payments: boolean;
    attendance: boolean;
    grades: boolean;
    broadcasts: boolean;
    exeats: boolean;
    birthdays: boolean;
  };
  gatewayConfigured: boolean;
};

/**
 * Fetches SMS wallet configuration and balance for a tenant.
 */
export async function getTenantSmsWallet(tenantId: number): Promise<TenantSmsWallet> {
  const defaultToggles = {
    payments: true,
    attendance: true,
    grades: true,
    broadcasts: true,
    exeats: true,
    birthdays: false,
  };

  const res = await query(
    `SELECT
       COALESCE(ss.sms_balance, t.sms_balance, 0)::int AS balance,
       COALESCE(NULLIF(TRIM(ss.sms_sender_id), ''), NULLIF(TRIM(t.sms_sender_id), ''), $2) AS sender_id,
       COALESCE(ss.sms_sender_id_status, 'default') AS sender_id_status,
       COALESCE(ss.sms_enabled, true) AS enabled,
       ss.sms_notification_toggles AS toggles
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId, getDefaultSenderId()]
  );

  const row = res.rows[0];
  const defaultId = getDefaultSenderId();
  const senderIdStatus = ((row?.sender_id_status as any) || 'default') as 'default' | 'pending' | 'approved' | 'rejected';
  const effectiveSenderId =
    senderIdStatus === 'approved' && row?.sender_id
      ? String(row.sender_id).slice(0, 11)
      : defaultId;

  const toggles = {
    ...defaultToggles,
    ...(row?.toggles && typeof row.toggles === 'object' ? row.toggles : {}),
  };

  return {
    balance: Number(row?.balance || 0),
    senderId: effectiveSenderId,
    senderIdStatus,
    enabled: Boolean(row?.enabled ?? true),
    toggles,
    gatewayConfigured: isArkeselConfigured(),
  };
}

/**
 * Check master Arkesel account balance from Arkesel API.
 */
export async function checkMasterArkeselBalance(): Promise<{
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}> {
  const apiKey = getMasterArkeselApiKey();
  if (!apiKey) {
    return { success: false, error: 'Master Arkesel API key is not configured in .env' };
  }

  try {
    const res = await fetch(`${ARKESEL_BASE_URL}/clients/balance-details`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        Accept: 'application/json',
      },
    });

    const data = (await res.json()) as any;
    if (!res.ok || data?.status === 'error') {
      return { success: false, error: data?.message || 'Failed to query Arkesel balance' };
    }

    const balanceInfo = data?.data || data;
    return {
      success: true,
      balance: Number(balanceInfo?.sms_balance ?? balanceInfo?.balance ?? 0),
      currency: balanceInfo?.currency || 'GHS',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error querying Arkesel balance' };
  }
}

/**
 * Credits SMS balance to a tenant (e.g. after Paystack verification or admin allocation).
 */
export async function creditTenantSmsBalance(
  tenantId: number,
  credits: number,
  reason = 'manual_credit',
  userId?: number
): Promise<{ previousBalance: number; newBalance: number }> {
  const amount = Math.floor(Math.max(0, credits));
  if (amount <= 0) {
    const w = await getTenantSmsWallet(tenantId);
    return { previousBalance: w.balance, newBalance: w.balance };
  }

  // Ensure school_settings row exists
  await query(
    `INSERT INTO school_settings (tenant_id, school_name, sms_balance)
     VALUES ($1, 'School', $2)
     ON CONFLICT (tenant_id)
     DO UPDATE SET sms_balance = COALESCE(school_settings.sms_balance, 0) + $2
     RETURNING sms_balance`,
    [tenantId, amount]
  );

  // Sync to tenants table
  const sync = await query(
    `UPDATE tenants
     SET sms_balance = COALESCE(sms_balance, 0) + $2
     WHERE id = $1
     RETURNING sms_balance`,
    [tenantId, amount]
  );

  const newBalance = Number(sync.rows[0]?.sms_balance || 0);
  const previousBalance = newBalance - amount;

  console.info(
    `[sms-wallet] Credited ${amount} SMS to tenant ${tenantId}. Previous: ${previousBalance}, New: ${newBalance}. Reason: ${reason} (by user: ${userId || 'system'})`
  );

  return { previousBalance, newBalance };
}

export type SendSmsInput = {
  tenantId: number;
  recipients: Array<{
    phone: string;
    name?: string;
    recipientType?: 'parent' | 'staff' | 'student' | 'custom';
  }>;
  message: string;
  eventType: SmsEventType;
  senderIdOverride?: string;
  skipToggleCheck?: boolean;
};

export type SendSmsResult = {
  success: boolean;
  sentCount: number;
  failedCount: number;
  creditsDeducted: number;
  remainingBalance: number;
  error?: string;
  skippedReason?: string;
};

export function resolveToggleKeyForEventType(eventType: SmsEventType): keyof TenantSmsWallet['toggles'] | null {
  switch (eventType) {
    case 'payment':
      return 'payments';
    case 'attendance':
      return 'attendance';
    case 'grades':
      return 'grades';
    case 'broadcast':
      return 'broadcasts';
    case 'exeats':
    case 'complaints':
      return 'exeats';
    case 'birthdays':
      return 'birthdays';
    default:
      return null;
  }
}

/**
 * Primary outbound SMS dispatch engine:
 * 1. Checks tenant wallet & toggle preferences
 * 2. Normalizes numbers & calculates segment cost
 * 3. Atomically deducts credits
 * 4. Dispatches via Arkesel v2 API
 * 5. Logs each message in `sms_logs`
 * 6. Refunds credits if gateway fails completely
 */
export async function sendArkeselSms(input: {
  tenantId: number;
  recipients: Array<{
    phone: string;
    name?: string;
    recipientType?: 'parent' | 'staff' | 'student' | 'custom';
  }>;
  message: string;
  eventType: SmsEventType;
  senderIdOverride?: string;
  skipToggleCheck?: boolean;
}): Promise<SendSmsResult> {
  const { tenantId, message, eventType, skipToggleCheck } = input;
  const trimmedMessage = String(message || '').trim();

  if (!trimmedMessage) {
    return { success: false, sentCount: 0, failedCount: 0, creditsDeducted: 0, remainingBalance: 0, error: 'Message cannot be empty' };
  }

  const wallet = await getTenantSmsWallet(tenantId);

  // Check if tenant has SMS globally enabled
  if (!wallet.enabled && !skipToggleCheck) {
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      creditsDeducted: 0,
      remainingBalance: wallet.balance,
      skippedReason: 'SMS is disabled in school settings',
    };
  }

  // Check event-specific toggle
  if (!skipToggleCheck && eventType !== 'test') {
    const toggleKey = resolveToggleKeyForEventType(eventType);
    if (toggleKey && wallet.toggles[toggleKey] === false) {
      console.info(`[arkesel] SMS skipped for tenant ${tenantId}: '${eventType}' (${toggleKey}) is toggled OFF.`);
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        creditsDeducted: 0,
        remainingBalance: wallet.balance,
        skippedReason: `SMS for '${eventType}' is toggled OFF in school preferences`,
      };
    }
  }

  // Check master gateway configuration
  const apiKey = getMasterArkeselApiKey();
  if (!apiKey) {
    console.warn(`[arkesel] Cannot send SMS for tenant ${tenantId}: ARKESEL_API_KEY is not configured.`);
    return {
      success: false,
      sentCount: 0,
      failedCount: input.recipients.length,
      creditsDeducted: 0,
      remainingBalance: wallet.balance,
      error: 'Platform SMS gateway is not configured yet. Please contact support.',
    };
  }

  // Clean, normalize and deduplicate recipients
  const cleanList: Array<{ phone: string; name?: string; recipientType?: string }> = [];
  const seenPhones = new Set<string>();

  for (const r of input.recipients) {
    const normalized = normalizePhoneNumber(r.phone);
    if (normalized && !seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      cleanList.push({
        phone: normalized,
        name: r.name ? String(r.name).trim() : undefined,
        recipientType: r.recipientType || 'parent',
      });
    }
  }

  if (cleanList.length === 0) {
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      creditsDeducted: 0,
      remainingBalance: wallet.balance,
      error: 'No valid phone numbers found among recipients',
    };
  }

  // Calculate required segments
  const { segments } = calculateSmsSegments(trimmedMessage);
  const totalCreditsNeeded = cleanList.length * segments;

  if (wallet.balance < totalCreditsNeeded) {
    console.warn(
      `[arkesel] Insufficient SMS balance for tenant ${tenantId}. Needed: ${totalCreditsNeeded}, Available: ${wallet.balance}`
    );
    return {
      success: false,
      sentCount: 0,
      failedCount: cleanList.length,
      creditsDeducted: 0,
      remainingBalance: wallet.balance,
      error: `Insufficient SMS credits. Required: ${totalCreditsNeeded} credit(s), Available: ${wallet.balance} credit(s). Please top up.`,
    };
  }

  // Atomically deduct credits from school_settings
  const deductRes = await query(
    `UPDATE school_settings
     SET sms_balance = sms_balance - $1
     WHERE tenant_id = $2 AND sms_balance >= $1
     RETURNING sms_balance`,
    [totalCreditsNeeded, tenantId]
  );

  if (deductRes.rows.length === 0) {
    return {
      success: false,
      sentCount: 0,
      failedCount: cleanList.length,
      creditsDeducted: 0,
      remainingBalance: wallet.balance,
      error: 'Insufficient SMS credits or balance update conflict. Please try again.',
    };
  }

  const remainingBalance = Number(deductRes.rows[0].sms_balance);
  // Keep tenants table synchronized
  await query(`UPDATE tenants SET sms_balance = $1 WHERE id = $2`, [remainingBalance, tenantId]).catch(() => {});

  // Determine sender ID (use approved tenant sender ID if available, otherwise default platform ID)
  let senderId = getDefaultSenderId();
  if (input.senderIdOverride && input.senderIdOverride.trim().length > 0) {
    senderId = input.senderIdOverride.trim().slice(0, 11);
  } else if (wallet.senderId && wallet.senderIdStatus === 'approved') {
    senderId = wallet.senderId.trim().slice(0, 11);
  }

  const recipientPhones = cleanList.map((c) => c.phone);

  try {
    // Send via Arkesel v2 API
    const response = await fetch(`${ARKESEL_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        message: trimmedMessage,
        recipients: recipientPhones,
      }),
    });

    const responseData = (await response.json()) as any;
    const isSuccess = response.ok && responseData?.status !== 'error';

    if (!isSuccess) {
      const errorMsg = responseData?.message || responseData?.error || 'Arkesel delivery rejected';
      console.error(`[arkesel] Dispatch failed for tenant ${tenantId}:`, errorMsg);

      // Refund deducted credits because message failed to send
      await query(
        `UPDATE school_settings SET sms_balance = sms_balance + $1 WHERE tenant_id = $2`,
        [totalCreditsNeeded, tenantId]
      ).catch(() => {});
      await query(`UPDATE tenants SET sms_balance = sms_balance + $1 WHERE id = $2`, [totalCreditsNeeded, tenantId]).catch(() => {});

      // Log failure in sms_logs
      for (const item of cleanList) {
        await query(
          `INSERT INTO sms_logs
             (tenant_id, recipient_phone, recipient_name, recipient_type, event_type, message, segment_count, credits_deducted, status, gateway_response, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'failed', $8, $9)`,
          [
            tenantId,
            item.phone,
            item.name || null,
            item.recipientType,
            eventType,
            trimmedMessage,
            segments,
            JSON.stringify(responseData || {}),
            errorMsg,
          ]
        ).catch(() => {});
      }

      return {
        success: false,
        sentCount: 0,
        failedCount: cleanList.length,
        creditsDeducted: 0,
        remainingBalance: remainingBalance + totalCreditsNeeded,
        error: errorMsg,
      };
    }

    // Success: log successful dispatches
    for (const item of cleanList) {
      await query(
        `INSERT INTO sms_logs
           (tenant_id, recipient_phone, recipient_name, recipient_type, event_type, message, segment_count, credits_deducted, status, gateway_response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', $9)`,
        [
          tenantId,
          item.phone,
          item.name || null,
          item.recipientType,
          eventType,
          trimmedMessage,
          segments,
          segments,
          JSON.stringify(responseData || {}),
        ]
      ).catch(() => {});
    }

    return {
      success: true,
      sentCount: cleanList.length,
      failedCount: 0,
      creditsDeducted: totalCreditsNeeded,
      remainingBalance,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network communication failure with Arkesel';
    console.error(`[arkesel] Exception sending SMS for tenant ${tenantId}:`, errorMsg);

    // Refund deducted credits
    await query(
      `UPDATE school_settings SET sms_balance = sms_balance + $1 WHERE tenant_id = $2`,
      [totalCreditsNeeded, tenantId]
    ).catch(() => {});
    await query(`UPDATE tenants SET sms_balance = sms_balance + $1 WHERE id = $2`, [totalCreditsNeeded, tenantId]).catch(() => {});

    for (const item of cleanList) {
      await query(
        `INSERT INTO sms_logs
           (tenant_id, recipient_phone, recipient_name, recipient_type, event_type, message, segment_count, credits_deducted, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'failed', $8)`,
        [tenantId, item.phone, item.name || null, item.recipientType, eventType, trimmedMessage, segments, errorMsg]
      ).catch(() => {});
    }

    return {
      success: false,
      sentCount: 0,
      failedCount: cleanList.length,
      creditsDeducted: 0,
      remainingBalance: remainingBalance + totalCreditsNeeded,
      error: errorMsg,
    };
  }
}

/**
 * Dispatch SMS to parents of a specific student.
 */
export async function sendSmsToStudentParents(
  tenantId: number,
  studentId: number,
  message: string,
  eventType: SmsEventType
): Promise<SendSmsResult> {
  const res = await query(
    `SELECT first_name, last_name, guardian_name, guardian_contact, guardian_2_name, guardian_2_contact
     FROM students
     WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );

  const row = res.rows[0];
  if (!row) {
    return { success: false, sentCount: 0, failedCount: 0, creditsDeducted: 0, remainingBalance: 0, error: 'Student not found' };
  }

  const recipients: Array<{ phone: string; name?: string; recipientType: 'parent' }> = [];
  if (row.guardian_contact) {
    recipients.push({
      phone: row.guardian_contact,
      name: row.guardian_name || `${row.first_name} ${row.last_name}'s Guardian`,
      recipientType: 'parent',
    });
  }
  if (row.guardian_2_contact && row.guardian_2_contact !== row.guardian_contact) {
    recipients.push({
      phone: row.guardian_2_contact,
      name: row.guardian_2_name || `${row.first_name} ${row.last_name}'s Secondary Guardian`,
      recipientType: 'parent',
    });
  }

  return sendArkeselSms({
    tenantId,
    recipients,
    message,
    eventType,
  });
}

/**
 * Dispatch SMS to parents of multiple students (deduplicated by phone).
 */
export async function sendSmsToStudentsParents(
  tenantId: number,
  studentIds: number[],
  message: string,
  eventType: SmsEventType
): Promise<SendSmsResult> {
  if (!studentIds.length) {
    return { success: false, sentCount: 0, failedCount: 0, creditsDeducted: 0, remainingBalance: 0, error: 'No students provided' };
  }

  const res = await query(
    `SELECT first_name, last_name, guardian_name, guardian_contact, guardian_2_name, guardian_2_contact
     FROM students
     WHERE id = ANY($1::int[]) AND tenant_id = $2 AND (is_deleted = false OR is_deleted IS NULL)`,
    [studentIds, tenantId]
  );

  const recipients: Array<{ phone: string; name?: string; recipientType: 'parent' }> = [];
  for (const s of res.rows) {
    if (s.guardian_contact) {
      recipients.push({
        phone: s.guardian_contact,
        name: s.guardian_name || `${s.first_name}'s Guardian`,
        recipientType: 'parent',
      });
    }
    if (s.guardian_2_contact) {
      recipients.push({
        phone: s.guardian_2_contact,
        name: s.guardian_2_name || `${s.first_name}'s Secondary Guardian`,
        recipientType: 'parent',
      });
    }
  }

  return sendArkeselSms({
    tenantId,
    recipients,
    message,
    eventType,
  });
}

/**
 * Dispatch SMS to all parents in a specific class.
 */
export async function sendSmsToClassParents(
  tenantId: number,
  classId: number,
  message: string,
  eventType: SmsEventType
): Promise<SendSmsResult> {
  const res = await query(
    `SELECT s.first_name, s.last_name, s.guardian_name, s.guardian_contact, s.guardian_2_name, s.guardian_2_contact
     FROM students s
     WHERE s.class_assigned_id = $1 AND s.tenant_id = $2
       AND (s.is_deleted = false OR s.is_deleted IS NULL)
       AND LOWER(COALESCE(s.enrollment_status, 'active')) = 'active'`,
    [classId, tenantId]
  );

  const recipients: Array<{ phone: string; name?: string; recipientType: 'parent' }> = [];
  for (const s of res.rows) {
    if (s.guardian_contact) {
      recipients.push({
        phone: s.guardian_contact,
        name: s.guardian_name || `${s.first_name}'s Guardian`,
        recipientType: 'parent',
      });
    }
    if (s.guardian_2_contact) {
      recipients.push({
        phone: s.guardian_2_contact,
        name: s.guardian_2_name || `${s.first_name}'s Secondary Guardian`,
        recipientType: 'parent',
      });
    }
  }

  return sendArkeselSms({
    tenantId,
    recipients,
    message,
    eventType,
  });
}

/**
 * Dispatch SMS to all parents in the entire school (active students).
 */
export async function sendSmsToTenantParents(
  tenantId: number,
  message: string,
  eventType: SmsEventType
): Promise<SendSmsResult> {
  const res = await query(
    `SELECT s.first_name, s.last_name, s.guardian_name, s.guardian_contact, s.guardian_2_name, s.guardian_2_contact
     FROM students s
     WHERE s.tenant_id = $1
       AND (s.is_deleted = false OR s.is_deleted IS NULL)
       AND LOWER(COALESCE(s.enrollment_status, 'active')) = 'active'`,
    [tenantId]
  );

  const recipients: Array<{ phone: string; name?: string; recipientType: 'parent' }> = [];
  for (const s of res.rows) {
    if (s.guardian_contact) {
      recipients.push({
        phone: s.guardian_contact,
        name: s.guardian_name || `${s.first_name}'s Guardian`,
        recipientType: 'parent',
      });
    }
    if (s.guardian_2_contact) {
      recipients.push({
        phone: s.guardian_2_contact,
        name: s.guardian_2_name || `${s.first_name}'s Secondary Guardian`,
        recipientType: 'parent',
      });
    }
  }

  return sendArkeselSms({
    tenantId,
    recipients,
    message,
    eventType,
  });
}

/**
 * Dispatch SMS to a staff member / user.
 */
export async function sendSmsToStaffUser(
  tenantId: number,
  userId: number,
  message: string,
  eventType: SmsEventType
): Promise<SendSmsResult> {
  const res = await query(
    `SELECT COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS name, COALESCE(NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(t.phone_number), '')) AS phone
     FROM users u
     LEFT JOIN teachers t ON t.user_id = u.id AND t.tenant_id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [userId, tenantId]
  );

  const row = res.rows[0];
  if (!row || !row.phone) {
    return { success: false, sentCount: 0, failedCount: 0, creditsDeducted: 0, remainingBalance: 0, error: 'Staff member phone not found' };
  }

  return sendArkeselSms({
    tenantId,
    recipients: [{ phone: row.phone, name: row.name, recipientType: 'staff' }],
    message,
    eventType,
  });
}
