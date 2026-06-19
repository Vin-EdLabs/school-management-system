import { query } from '../db/connection.js';

export type CardTypeKey = 'STUDENT' | 'STAFF';

/** Shared template row — one config per school (card_type stored as SCHOOL). */
export type IDCardTemplateRow = {
  primary_color: string;
  accent_color: string;
  footer_bg: string;
  powered_by_color: string;
  school_slogan: string;
  school_phone: string;
  school_website: string;
  school_code: string;
  school_email: string;
  back_header_text: string;
  instructions: string[];
};

const DEFAULT_BACK_HEADER = 'This card is the property of {schoolName}.';

export const DEFAULT_INSTRUCTIONS = [
  'This card identifies the bearer as a member of {schoolName}.',
  'It must be worn at all times within the school premises.',
  'This card is non-transferable.',
  'If found, please return to the school office.',
];

export const DEFAULT_TEMPLATE: IDCardTemplateRow = {
  primary_color: '#1a3a6b',
  accent_color: '#c9a227',
  footer_bg: '#1a3a6b',
  powered_by_color: '#ffffff',
  school_slogan: 'Excellence • Discipline • Character',
  school_phone: '',
  school_website: '',
  school_code: '',
  school_email: '',
  back_header_text: DEFAULT_BACK_HEADER,
  instructions: [...DEFAULT_INSTRUCTIONS],
};

function parseInstructions(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item) => String(item));
  }
  return [...DEFAULT_INSTRUCTIONS];
}

function normalizeRow(row: Record<string, unknown> | undefined): IDCardTemplateRow {
  const d = DEFAULT_TEMPLATE;
  if (!row) return { ...d };
  return {
    primary_color: String(row.primary_color || d.primary_color),
    accent_color: String(row.accent_color || d.accent_color),
    footer_bg: String(row.footer_bg || row.primary_color || d.footer_bg),
    powered_by_color: String(row.powered_by_color || d.powered_by_color),
    school_slogan: String(row.school_slogan ?? d.school_slogan),
    school_phone: String(row.school_phone ?? d.school_phone),
    school_website: String(row.school_website ?? d.school_website),
    school_code: String(row.school_code ?? d.school_code),
    school_email: String(row.school_email ?? d.school_email),
    back_header_text: String(row.back_header_text ?? d.back_header_text),
    instructions: parseInstructions(row.instructions),
  };
}

export function renderTemplateText(text: string, schoolName: string): string {
  return String(text || '').replace(/\{schoolName\}/g, schoolName);
}

export function renderTemplateInstructions(instructions: string[], schoolName: string): string[] {
  return instructions.map((line) => renderTemplateText(line, schoolName));
}

export async function ensureIdCardTemplates(tenantId: number): Promise<void> {
  const existing = await query(
    `SELECT id FROM id_card_templates WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (existing.rows.length > 0) return;

  const ctx = await getSchoolCardContext(tenantId);
  const slug = String(ctx?.slug || 'school');
  const d = DEFAULT_TEMPLATE;
  await query(
    `INSERT INTO id_card_templates (
       tenant_id, card_type, primary_color, accent_color, footer_bg, powered_by_color,
       school_slogan, school_phone, school_website, school_code, school_email, back_header_text, instructions
     )
     VALUES ($1, 'SCHOOL', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      tenantId,
      d.primary_color,
      d.accent_color,
      d.footer_bg,
      d.powered_by_color,
      d.school_slogan,
      d.school_phone,
      d.school_website,
      slug.toUpperCase().slice(0, 6),
      String(ctx?.email || ''),
      d.back_header_text,
      JSON.stringify(d.instructions),
    ]
  );
}

async function fetchTemplateRow(tenantId: number) {
  const res = await query(
    `SELECT primary_color, accent_color, footer_bg, powered_by_color,
            school_slogan, school_phone, school_website, school_code, school_email,
            back_header_text, instructions
     FROM id_card_templates
     WHERE tenant_id = $1
     ORDER BY CASE card_type WHEN 'SCHOOL' THEN 0 WHEN 'STUDENT' THEN 1 ELSE 2 END, updated_at DESC
     LIMIT 1`,
    [tenantId]
  );
  return res.rows[0] as Record<string, unknown> | undefined;
}

/** cardType kept for API compatibility — all types share one school template. */
export async function getIdCardTemplate(
  tenantId: number,
  _cardType?: CardTypeKey
): Promise<IDCardTemplateRow> {
  await ensureIdCardTemplates(tenantId);
  return normalizeRow(await fetchTemplateRow(tenantId));
}

export type IDCardTemplateUpdate = Partial<IDCardTemplateRow> & {
  instructions?: string[];
};

export async function updateIdCardTemplate(
  tenantId: number,
  _cardType: CardTypeKey | 'SCHOOL',
  patch: IDCardTemplateUpdate
): Promise<IDCardTemplateRow> {
  await ensureIdCardTemplates(tenantId);
  const current = await getIdCardTemplate(tenantId);
  const next: IDCardTemplateRow = {
    ...current,
    ...patch,
    instructions: patch.instructions ?? current.instructions,
  };
  await query(
    `UPDATE id_card_templates
     SET primary_color = $1, accent_color = $2, footer_bg = $3, powered_by_color = $4,
         school_slogan = $5, school_phone = $6, school_website = $7,
         school_code = $8, school_email = $9,
         back_header_text = $10, instructions = $11, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $12`,
    [
      next.primary_color,
      next.accent_color,
      next.footer_bg,
      next.powered_by_color,
      next.school_slogan,
      next.school_phone,
      next.school_website,
      next.school_code,
      next.school_email,
      next.back_header_text,
      JSON.stringify(next.instructions),
      tenantId,
    ]
  );
  return next;
}

export function mapTemplateToApi(row: IDCardTemplateRow) {
  return {
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    footerBg: row.footer_bg || row.primary_color,
    poweredByColor: row.powered_by_color || row.accent_color,
    schoolSlogan: row.school_slogan,
    schoolPhone: row.school_phone,
    schoolWebsite: row.school_website,
    schoolCode: row.school_code,
    schoolEmail: row.school_email,
    backHeaderText: row.back_header_text,
    instructions: row.instructions,
  };
}

export async function getSchoolCardContext(tenantId: number) {
  const res = await query(
    `SELECT ss.school_name, ss.contact_phone, ss.phone_number, ss.contact, ss.logo_url, ss.email,
            ss.current_year, ss.current_term, t.slug, t.name AS tenant_name
     FROM school_settings ss
     JOIN tenants t ON t.id = ss.tenant_id
     WHERE ss.tenant_id = $1`,
    [tenantId]
  );
  return res.rows[0] || null;
}

export function formatIdCardAcademicYear(raw: string | number | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) {
    const y = new Date().getFullYear();
    return `${y} / ${y + 1}`;
  }
  const cleaned = s.replace(/[^\d\s/\-–]/g, '').replace(/\s+/g, ' ').trim();
  const slash = cleaned.match(/^(\d{4})\s*[\/\-–]\s*(\d{4})$/);
  if (slash) return `${slash[1]} / ${slash[2]}`;
  const single = cleaned.match(/^(\d{4})$/);
  if (single) {
    const y = parseInt(single[1], 10);
    return `${y} / ${y + 1}`;
  }
  const lead = cleaned.match(/^(\d{4})/);
  if (lead) {
    const y = parseInt(lead[1], 10);
    const tail = cleaned.match(/[\/\-–]\s*(\d{4})/);
    const y2 = tail ? parseInt(tail[1], 10) : y + 1;
    return `${y} / ${y2}`;
  }
  const y = new Date().getFullYear();
  return `${y} / ${y + 1}`;
}

export function buildDefaultCardDataFromTemplate(
  template: IDCardTemplateRow,
  ctx: {
    schoolName: string;
    slug: string;
    phone: string;
    email?: string;
    logoUrl: string | null;
  },
  entityDefaults: Record<string, unknown>
): Record<string, unknown> {
  const schoolName = ctx.schoolName;
  const phone = template.school_phone || ctx.phone;
  const website = String(template.school_website || '').trim();
  const email = String(template.school_email || ctx.email || '').trim();
  const schoolCode =
    String(template.school_code || '').trim() || ctx.slug.toUpperCase().slice(0, 6);
  return {
    schoolName,
    motto: template.school_slogan || DEFAULT_TEMPLATE.school_slogan,
    schoolCode,
    phone,
    website,
    email,
    logoUrl: ctx.logoUrl,
    photoBase64: null,
    propertyHeader: renderTemplateText(template.back_header_text, schoolName),
    instructions: renderTemplateInstructions(template.instructions, schoolName),
    scanLabel: 'Scan to verify identity',
    ...entityDefaults,
  };
}

/** Always apply latest template + school context; preserve entity-specific fields only. */
export function mergeCardDataWithTemplate(
  template: IDCardTemplateRow,
  ctx: {
    schoolName: string;
    slug: string;
    phone: string;
    email?: string;
    logoUrl: string | null;
  },
  entityFields: Record<string, unknown>,
  verifyUrl: string
): Record<string, unknown> {
  const fresh = buildDefaultCardDataFromTemplate(template, ctx, {
    qrUrl: verifyUrl,
    photoUrl: entityFields.photoUrl ?? null,
    photoBase64: entityFields.photoBase64 ?? null,
    fullName: entityFields.fullName,
    idNumber: entityFields.idNumber,
    academicYear: entityFields.academicYear,
    position: entityFields.position,
    department: entityFields.department,
    className: entityFields.className,
  });
  return fresh;
}
