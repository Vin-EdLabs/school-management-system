import crypto from 'crypto';
import { query } from '../db/connection.js';

export const PARTNER_BASE_COMMISSION_RATE = 30;
export const PARTNER_BONUS_COMMISSION_RATE = 50;
export const PARTNER_BONUS_MONTHS = 2;

export type PartnerTier = 'partner' | 'senior_partner' | 'team_leader' | 'regional_director';

export function tierForSchoolCount(count: number): PartnerTier {
  if (count >= 10) return 'regional_director';
  if (count >= 5) return 'team_leader';
  if (count >= 3) return 'senior_partner';
  return 'partner';
}

export const TIER_LABELS: Record<PartnerTier, string> = {
  partner: 'Partner',
  senior_partner: 'Senior Partner',
  team_leader: 'Team Leader',
  regional_director: 'Regional Director',
};

/** Recalculate a partner's tier from their converted-school count. */
export async function recalcPartnerTier(partnerDbId: number): Promise<PartnerTier> {
  const countRes = await query(
    `SELECT COUNT(*)::int AS converted
       FROM partner_school_leads
      WHERE partner_id = $1 AND status = 'converted'`,
    [partnerDbId]
  );
  const converted = Number(countRes.rows[0]?.converted || 0);
  const tier = tierForSchoolCount(converted);
  await query(
    `UPDATE partners SET tier = $1, updated_at = NOW() WHERE id = $2`,
    [tier, partnerDbId]
  );
  return tier;
}

/** Generate a unique public partner ID: SN-XXX-XX (five random digits). */
export async function generatePartnerPublicId(): Promise<string> {
  const maxAttempts = 80;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 10000–99999 → always 5 digits; last two (XX) are fully random.
    const fiveDigits = crypto.randomInt(10000, 100000);
    const middle = Math.floor(fiveDigits / 100);
    const last = fiveDigits % 100;
    const publicId = `SN-${middle}-${String(last).padStart(2, '0')}`;

    const exists = await query(
      'SELECT 1 FROM partners WHERE partner_id = $1 LIMIT 1',
      [publicId],
    );
    if (exists.rows.length === 0) return publicId;
  }
  throw new Error('Failed to generate unique partner ID');
}

/** Commission rate for a given billing month relative to conversion date. */
function rateForMonth(convertedAt: Date, year: number, month: number): number {
  const monthsSince =
    (year - convertedAt.getFullYear()) * 12 + (month - (convertedAt.getMonth() + 1));
  return monthsSince < PARTNER_BONUS_MONTHS
    ? PARTNER_BONUS_COMMISSION_RATE
    : PARTNER_BASE_COMMISSION_RATE;
}

/**
 * Ensure every converted lead has a pending commission record for the current
 * month. Idempotent via UNIQUE (lead_id, month, year) — safe to call from any
 * commissions read path. First 2 months after conversion earn the bonus rate.
 */
export async function ensureMonthlyCommissions(partnerDbId?: number): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leads = await query(
    `SELECT id, partner_id, converted_school_id, converted_at, plan_amount, commission_rate
       FROM partner_school_leads
      WHERE status = 'converted'
        AND plan_amount IS NOT NULL AND plan_amount > 0
        ${partnerDbId ? 'AND partner_id = $1' : ''}`,
    partnerDbId ? [partnerDbId] : []
  );

  for (const lead of leads.rows) {
    const convertedAt = lead.converted_at ? new Date(lead.converted_at) : now;
    const planAmount = Number(lead.plan_amount);
    // Bonus window always wins; afterwards use the lead's negotiated rate if set.
    const inBonusWindow =
      rateForMonth(convertedAt, year, month) === PARTNER_BONUS_COMMISSION_RATE;
    const effectiveRate = inBonusWindow
      ? PARTNER_BONUS_COMMISSION_RATE
      : lead.commission_rate
        ? Number(lead.commission_rate)
        : PARTNER_BASE_COMMISSION_RATE;
    const amount = Math.round(planAmount * effectiveRate) / 100;

    await query(
      `INSERT INTO partner_commissions
         (partner_id, school_id, lead_id, month, year, plan_amount, commission_rate, commission_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       ON CONFLICT (lead_id, month, year) DO NOTHING`,
      [
        lead.partner_id,
        lead.converted_school_id,
        lead.id,
        month,
        year,
        planAmount,
        effectiveRate,
        amount,
      ]
    );
  }
}

/** Create or update a pending commission for a specific lead + month (admin / lifetime payouts). */
export async function upsertPartnerCommission(params: {
  partnerDbId: number;
  leadId: number;
  month: number;
  year: number;
  planAmount: number;
  commissionRate: number;
  commissionAmount?: number;
}): Promise<any> {
  const { partnerDbId, leadId, month, year, planAmount, commissionRate, commissionAmount } = params;

  const leadRes = await query(
    `SELECT id, partner_id, converted_school_id, status
       FROM partner_school_leads
      WHERE id = $1 AND partner_id = $2`,
    [leadId, partnerDbId]
  );
  if (leadRes.rows.length === 0) {
    throw new Error('Lead not found for this partner');
  }
  const lead = leadRes.rows[0];
  if (lead.status !== 'converted') {
    throw new Error('Only converted schools can have commissions');
  }

  const amount =
    commissionAmount !== undefined && commissionAmount !== null
      ? Number(commissionAmount)
      : Math.round(planAmount * commissionRate) / 100;

  const result = await query(
    `INSERT INTO partner_commissions
       (partner_id, school_id, lead_id, month, year, plan_amount, commission_rate, commission_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     ON CONFLICT (lead_id, month, year)
     DO UPDATE SET
       plan_amount = EXCLUDED.plan_amount,
       commission_rate = EXCLUDED.commission_rate,
       commission_amount = EXCLUDED.commission_amount
     WHERE partner_commissions.status = 'pending'
     RETURNING *`,
    [
      partnerDbId,
      lead.converted_school_id,
      leadId,
      month,
      year,
      planAmount,
      commissionRate,
      amount,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Commission for this month is already paid and cannot be changed');
  }

  await query(
    `UPDATE partner_school_leads SET plan_amount = $1, commission_rate = $2, updated_at = NOW()
      WHERE id = $3`,
    [planAmount, commissionRate, leadId]
  );

  return result.rows[0];
}
