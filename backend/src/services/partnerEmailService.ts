import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { query } from '../db/connection.js';
import { sendAdminEmail } from './emailService.js';
import {
  buildPartnerEmail,
  type PartnerEmailTemplate,
  type PartnerEmailVars,
} from './partnerEmailTemplates.js';
import { resolvePartnerEmailUrls, resolvePartnerPortalBaseUrl } from '../utils/publicAppUrl.js';
import { getPartnerLogoAttachment, getPartnerLogoDataUri, partnerLogoCidSrc } from './partnerEmailAssets.js';

type UrlRequest = Pick<Request, 'protocol' | 'get' | 'hostname' | 'headers'>;

export type PartnerRow = {
  id: number;
  first_name: string;
  last_name?: string;
  email: string;
  partner_id?: string | null;
  status?: string;
};

async function logPartnerEmail(opts: {
  partnerDbId: number | null;
  template: PartnerEmailTemplate;
  subject: string;
  preview: string;
  batchId: string;
}): Promise<void> {
  await query(
    `INSERT INTO partner_emails (partner_id, template, subject, body_preview, batch_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [opts.partnerDbId, opts.template, opts.subject, opts.preview, opts.batchId]
  ).catch((err) => console.warn('[partner-email] log failed:', err));
}

/** Send a transactional or custom email to one partner. */
export async function sendPartnerEmail(
  partner: PartnerRow,
  template: PartnerEmailTemplate,
  extra: Partial<PartnerEmailVars> = {},
  batchId?: string,
  req?: UrlRequest
): Promise<boolean> {
  const vars: PartnerEmailVars = {
    firstName: partner.first_name,
    lastName: partner.last_name,
    partnerId: partner.partner_id,
    ...extra,
  };
  const urls = resolvePartnerEmailUrls(req);
  const { subject, html, text, preview } = buildPartnerEmail(template, vars, {
    ...urls,
    logoSrc: partnerLogoCidSrc(),
  });
  const bid = batchId || randomUUID();

  const ok = await sendAdminEmail({
    to: String(partner.email),
    subject,
    text,
    html,
    attachments: [await getPartnerLogoAttachment()],
  });

  if (ok) {
    await logPartnerEmail({
      partnerDbId: partner.id,
      template,
      subject,
      preview,
      batchId: bid,
    });
  }
  return ok;
}

export async function resolvePartnerEmailRecipients(audience: string, partnerDbId?: number) {
  if (audience === 'specific') {
    if (!partnerDbId) return [];
    const res = await query(
      `SELECT id, first_name, last_name, email, partner_id, status FROM partners WHERE id = $1`,
      [partnerDbId]
    );
    return res.rows as PartnerRow[];
  }
  if (audience === 'approved') {
    const res = await query(
      `SELECT id, first_name, last_name, email, partner_id, status FROM partners WHERE status = 'approved'`
    );
    return res.rows as PartnerRow[];
  }
  if (audience === 'pending') {
    const res = await query(
      `SELECT id, first_name, last_name, email, partner_id, status FROM partners WHERE status = 'pending'`
    );
    return res.rows as PartnerRow[];
  }
  if (audience === 'suspended') {
    const res = await query(
      `SELECT id, first_name, last_name, email, partner_id, status FROM partners WHERE status = 'suspended'`
    );
    return res.rows as PartnerRow[];
  }
  const res = await query(
    `SELECT id, first_name, last_name, email, partner_id, status FROM partners WHERE status <> 'rejected'`
  );
  return res.rows as PartnerRow[];
}

/** Bulk send from super-admin Email tab. */
export async function sendPartnerEmailBatch(opts: {
  template: PartnerEmailTemplate;
  audience: string;
  partnerDbId?: number;
  note?: string;
  customSubject?: string;
  customBody?: string;
  req?: UrlRequest;
}): Promise<{ sentCount: number; recipientCount: number }> {
  const recipients = await resolvePartnerEmailRecipients(opts.audience, opts.partnerDbId);
  if (recipients.length === 0) {
    return { sentCount: 0, recipientCount: 0 };
  }

  const batchId = randomUUID();
  let sentCount = 0;
  for (const partner of recipients) {
    const ok = await sendPartnerEmail(
      partner,
      opts.template,
      {
        note: opts.note,
        customSubject: opts.customSubject,
        customBody: opts.customBody,
      },
      batchId,
      opts.req
    );
    if (ok) sentCount += 1;
  }
  return { sentCount, recipientCount: recipients.length };
}

/** Build preview HTML for super-admin Email tab (embedded logo). */
export async function previewPartnerEmail(opts: {
  template: PartnerEmailTemplate;
  note?: string;
  customSubject?: string;
  customBody?: string;
  sampleFirstName?: string;
  samplePartnerId?: string | null;
  req?: UrlRequest;
}): Promise<{ subject: string; html: string; text: string; preview: string }> {
  const urls = resolvePartnerEmailUrls(opts.req);
  const logoSrc = await getPartnerLogoDataUri();
  const loginBase = resolvePartnerPortalBaseUrl(opts.req);
  return buildPartnerEmail(
    opts.template,
    {
      firstName: opts.sampleFirstName || 'Partner',
      partnerId: opts.samplePartnerId || 'SN-453-12',
      note: opts.note,
      customSubject: opts.customSubject,
      customBody: opts.customBody,
      resetLink: `${loginBase}/reset-password?token=preview`,
    },
    { ...urls, logoSrc }
  );
}

const PARTNER_ADMIN_EMAIL = process.env.PARTNER_ADMIN_EMAIL || 'scholarnerve@gmail.com';

/** Notify ScholarNerve team when a new partner application is submitted. */
export async function notifyAdminNewPartnerApplication(
  partner: PartnerRow & { region?: string; town?: string | null; phone?: string; occupation?: string | null }
): Promise<void> {
  const name = `${partner.first_name} ${partner.last_name || ''}`.trim();
  const subject = `New partner application — ${name}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${partner.email}`,
    `Phone: ${partner.phone || '—'}`,
    `Region: ${partner.region || '—'}`,
    partner.town ? `Town: ${partner.town}` : null,
    partner.occupation ? `Occupation: ${partner.occupation}` : null,
  ].filter(Boolean);
  const text = `A new ScholarNerve Partner application was submitted.\n\n${lines.join('\n')}\n\nReview it in the Super Admin Partner Network panel.`;
  const html = `<p style="font-family:sans-serif;font-size:15px;color:#334155;">A new partner application was submitted.</p>
    <ul style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#334155;">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <p style="font-family:sans-serif;font-size:14px;color:#64748b;">Review it in the Super Admin Partner Network panel.</p>`;

  await sendAdminEmail({
    to: PARTNER_ADMIN_EMAIL,
    subject,
    text,
    html,
  }).catch(() => undefined);
}
