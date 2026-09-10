import { query } from '../db/connection.js';

const BRANDING_KEY = 'invoice_branding';

export type InvoiceBranding = {
  companyName: string;
  tagline: string;
  address: string;
  email: string;
  phone: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  momoNumber: string | null;
  defaultNotes: string | null;
  logoUrl: string | null;
};

export const DEFAULT_INVOICE_BRANDING: InvoiceBranding = {
  companyName: 'ScholarNerve',
  tagline: 'Empowering minds through intelligent learning',
  address: 'Accra, Ghana',
  email: 'scholarnerve@gmail.com',
  phone: '+233 20 000 0000',
  bankName: null,
  bankAccountName: null,
  bankAccountNumber: null,
  momoNumber: null,
  defaultNotes:
    'Thank you for choosing ScholarNerve. This invoice covers your subscription for the period indicated. For any questions, please contact us.',
  logoUrl: null,
};

function parseBranding(value: unknown): InvoiceBranding {
  const raw = value && typeof value === 'object' ? (value as Partial<InvoiceBranding>) : {};
  return {
    companyName: raw.companyName?.trim() || DEFAULT_INVOICE_BRANDING.companyName,
    tagline: raw.tagline?.trim() || DEFAULT_INVOICE_BRANDING.tagline,
    address: raw.address?.trim() || DEFAULT_INVOICE_BRANDING.address,
    email: raw.email?.trim() || DEFAULT_INVOICE_BRANDING.email,
    phone: raw.phone?.trim() || DEFAULT_INVOICE_BRANDING.phone,
    bankName: raw.bankName?.trim() || null,
    bankAccountName: raw.bankAccountName?.trim() || null,
    bankAccountNumber: raw.bankAccountNumber?.trim() || null,
    momoNumber: raw.momoNumber?.trim() || null,
    defaultNotes: raw.defaultNotes?.trim() || DEFAULT_INVOICE_BRANDING.defaultNotes,
    logoUrl: raw.logoUrl?.trim() || null,
  };
}

export async function getInvoiceBranding(): Promise<InvoiceBranding> {
  try {
    const result = await query(`SELECT value FROM platform_settings WHERE key = $1`, [BRANDING_KEY]);
    if (!result.rows[0]?.value) return DEFAULT_INVOICE_BRANDING;
    return parseBranding(result.rows[0].value);
  } catch {
    return DEFAULT_INVOICE_BRANDING;
  }
}

export async function updateInvoiceBranding(
  patch: Partial<InvoiceBranding>,
  updatedBy: number | null
): Promise<InvoiceBranding> {
  const current = await getInvoiceBranding();
  const next = parseBranding({ ...current, ...patch });

  await query(
    `INSERT INTO platform_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [BRANDING_KEY, JSON.stringify(next), updatedBy]
  );

  return next;
}
