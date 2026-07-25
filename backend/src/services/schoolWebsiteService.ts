import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from './auditService.js';
import { getActiveAcademicTermId } from './studentTermTrackingService.js';
import { notifySuperAdminsOfSupportMessage } from './commsNotifyService.js';
import {
  buildSchoolWebsitePublicUrl,
  DEFAULT_WEBSITE_URL_SUFFIX,
  getEffectivePublicWebsiteSlug,
  getSchoolUrls,
  normalizePublicWebsiteSlug,
  normalizeWebsiteUrlSuffix,
  validatePublicWebsiteSlug,
  validateWebsiteUrlSuffix,
} from '../utils/schoolWebsiteHost.js';

export type WebsiteHighlight = { icon: string; title: string; description: string };
export type WebsiteStats = {
  founded_year?: number | null;
  student_count?: number | null;
  programs_count?: number | null;
  pass_rate?: string | null;
};
export type WebsiteHomeContent = {
  enrolment_label?: string | null;
  welcome_heading?: string | null;
  welcome_heading_accent?: string | null;
  welcome_link_text?: string | null;
  highlights_eyebrow?: string | null;
  highlights_title?: string | null;
  highlights_bg_color?: string | null;
  cta_title?: string | null;
  cta_subtitle?: string | null;
  cta_button_text?: string | null;
  cta_bg_color?: string | null;
};
export type ApplicationStatus = 'pending' | 'under_review' | 'accepted' | 'rejected';
export type GalleryCategory =
  | 'all'
  | 'classrooms'
  | 'labs'
  | 'events'
  | 'activities'
  | 'facilities';

export type WebsiteEventImage = { url: string; caption?: string };
export type WebsiteEvent = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  gallery_images: WebsiteEventImage[];
  is_published: boolean;
  sort_order: number;
};

export function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_TYPES = new Set([...ALLOWED_IMAGE_TYPES, 'application/pdf']);
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'application/x-pdf': 'application/pdf',
  'application/acrobat': 'application/pdf',
  'application/octet-stream': 'application/octet-stream',
};

export function resolveUploadMimeType(mimetype: string, originalname?: string): string {
  const ext = originalname?.split('.').pop()?.toLowerCase();
  let normalized = String(mimetype || '').split(';')[0].trim().toLowerCase();
  normalized = MIME_ALIASES[normalized] || normalized;

  if (ALLOWED_DOCUMENT_TYPES.has(normalized)) return normalized;

  if (
    (normalized === 'application/octet-stream' || !normalized) &&
    ext &&
    EXT_TO_MIME[ext]
  ) {
    return EXT_TO_MIME[ext];
  }

  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  throw httpError(400, 'File must be JPG, PNG, WebP, or PDF');
}

type SubmittedDocument = { name: string; url: string; type: string; label?: string };

export function normalizeSubmittedDocuments(raw: unknown): SubmittedDocument[] {
  if (!Array.isArray(raw)) return [];
  const out: SubmittedDocument[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const doc = item as Record<string, unknown>;
    const url = String(doc.url || '').trim();
    if (!url.startsWith('data:')) continue;
    const name = String(doc.name || doc.label || 'document').trim() || 'document';
    const label = doc.label ? String(doc.label).trim() : undefined;
    let type = String(doc.type || '').trim().toLowerCase();
    if (!type || type === 'application/octet-stream') {
      try {
        type = resolveUploadMimeType('', name);
      } catch {
        if (url.startsWith('data:application/pdf')) type = 'application/pdf';
        else if (url.startsWith('data:image/')) type = url.slice(5, url.indexOf(';'));
        else continue;
      }
    }
    out.push({ name, url, type, ...(label ? { label } : {}) });
  }
  return out;
}

export function bufferToDataUrl(file: {
  mimetype: string;
  size: number;
  buffer: Buffer;
  originalname?: string;
}): string {
  const mime = resolveUploadMimeType(file.mimetype, file.originalname);
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw httpError(400, 'File must be 5MB or smaller');
  }
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
}

async function ensureWebsiteRow(tenantId: number): Promise<void> {
  await query(
    `INSERT INTO school_websites (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  await query(
    `INSERT INTO school_website_about (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  await query(
    `INSERT INTO school_website_admission_config (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  await query(
    `INSERT INTO school_website_careers_config (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  await query(
    `INSERT INTO school_website_contact (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
}

function mapWebsiteRow(row: Record<string, unknown>, tenant: Record<string, unknown>) {
  const tenantSlug = String(tenant.slug || '');
  const publicSubdomainRaw = (row.public_subdomain as string | null) || null;
  const websiteUrlSuffix =
    normalizeWebsiteUrlSuffix(String(row.website_url_suffix || DEFAULT_WEBSITE_URL_SUFFIX)) ||
    DEFAULT_WEBSITE_URL_SUFFIX;
  const effectivePublicSlug = getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomainRaw);
  const urls = getSchoolUrls(tenantSlug, websiteUrlSuffix, publicSubdomainRaw);
  return {
    tenant_id: Number(row.tenant_id),
    school_name: tenant.name as string,
    slug: tenantSlug,
    website_url_suffix: websiteUrlSuffix,
    public_subdomain: publicSubdomainRaw,
    effective_public_subdomain: effectivePublicSlug,
    public_site_url: buildSchoolWebsitePublicUrl(tenantSlug, websiteUrlSuffix, {
      publicSubdomain: publicSubdomainRaw,
    }),
    portal_url: `https://${urls.portal}`,
    is_enabled: !!row.is_enabled,
    is_published: !!row.is_published,
    accent_color: (row.accent_color as string) || (tenant.primary_color as string) || '#2563eb',
    custom_accent: (row.accent_color as string) || null,
    logo_url: (row.logo_url as string) || (tenant.logo_url as string) || null,
    banner_image_url: (row.banner_image_url as string) || null,
    tagline: (row.tagline as string) || null,
    welcome_text: (row.welcome_text as string) || null,
    welcome_image_url: (row.welcome_image_url as string) || null,
    welcome_image_secondary_url: (row.welcome_image_secondary_url as string) || null,
    home_content: (row.home_content as WebsiteHomeContent) || {},
    highlights: (row.highlights as WebsiteHighlight[]) || [],
    stats: (row.stats as WebsiteStats) || {},
    social_links: (row.social_links as Record<string, string>) || {},
    updated_at: row.updated_at as string,
  };
}

export async function getPublicWebsiteBundle(tenantId: number) {
  const tenantRes = await query(
    `SELECT id, name, slug, logo_url, primary_color, secondary_color FROM tenants WHERE id = $1 AND is_active = true`,
    [tenantId]
  );
  const tenant = tenantRes.rows[0];
  if (!tenant) throw httpError(404, 'School not found');

  await ensureWebsiteRow(tenantId);
  const siteRes = await query(`SELECT * FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  const site = siteRes.rows[0];
  if (!site?.is_enabled) {
    return { enabled: false as const, tenant: { name: tenant.name, slug: tenant.slug } };
  }
  if (!site?.is_published) {
    return { enabled: false as const, tenant: { name: tenant.name, slug: tenant.slug }, comingSoon: true as const };
  }

  const { ensureDemoWebsiteGalleryIfEmpty } = await import('../demo/demoWebsiteSeed.js');
  await ensureDemoWebsiteGalleryIfEmpty(tenantId).catch(() => undefined);

  const [aboutRes, admissionRes, careersRes, contactRes, settingsRes, galleryRes, eventsRes, classesRes, teamRes, alumniRes] = await Promise.all([
    query(`SELECT * FROM school_website_about WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT * FROM school_website_admission_config WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT * FROM school_website_careers_config WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT * FROM school_website_contact WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT address, email FROM school_settings WHERE tenant_id = $1`, [tenantId]),
    query(
      `SELECT id, url, thumbnail_url, category, sort_order, uploaded_at
       FROM school_website_gallery WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
      [tenantId]
    ),
    query(
      `SELECT id, title, description, event_date, event_time, location, cover_image_url, gallery_images, sort_order
       FROM school_website_events
       WHERE tenant_id = $1 AND is_published = true
       ORDER BY event_date DESC, sort_order ASC, id DESC`,
      [tenantId]
    ),
    listPublicClasses(tenantId),
    listPublicTeamMembers(tenantId),
    listPublicAlumniProfiles(tenantId),
  ]);

  const about = aboutRes.rows[0] || {};
  const admission = admissionRes.rows[0] || {};
  const careers = careersRes.rows[0] || {};
  const contact = contactRes.rows[0] || {};
  const settings = settingsRes.rows[0] || {};

  return {
    enabled: true as const,
    website: mapWebsiteRow(site, tenant),
    about: {
      history: about.history || null,
      vision: about.vision || null,
      mission: about.mission || null,
      core_values: about.core_values || [],
      director_message: about.director_message || null,
      director_name: about.director_name || null,
      director_title: about.director_title || null,
      director_photo_url: about.director_photo_url || null,
      institution_overview: about.institution_overview || null,
      history_image_url: about.history_image_url || null,
      overview_image_url: about.overview_image_url || null,
    },
    admission: {
      requirements: admission.requirements || null,
      programs: admission.programs || [],
      applications_open: admission.applications_open !== false,
      open_date: admission.open_date || null,
      close_date: admission.close_date || null,
    },
    careers: {
      applications_open: careers.applications_open !== false,
      intro_text: careers.intro_text || null,
    },
    contact: {
      primary_phone: contact.primary_phone || null,
      secondary_phone: contact.secondary_phone || null,
      email: contact.email || settings.email || null,
      address: contact.address || settings.address || null,
      map_embed_url: contact.map_embed_url || null,
      working_hours: contact.working_hours || null,
    },
    gallery: galleryRes.rows.map((g) => ({
      id: Number(g.id),
      url: g.url as string,
      thumbnail_url: (g.thumbnail_url as string) || (g.url as string),
      category: g.category as string,
      sort_order: Number(g.sort_order),
    })),
    events: eventsRes.rows.map((row) => mapEventRow(row)),
    classes: classesRes,
    management: {
      leadership: teamRes.filter((m) => m.member_type === 'leadership'),
      teachers: teamRes.filter((m) => m.member_type === 'teacher'),
    },
    alumni_profiles: alumniRes,
  };
}

async function listPublicClasses(tenantId: number): Promise<Array<{ id: number; name: string; level: string | null }>> {
  try {
    const result = await query(
      `SELECT id, TRIM(class_name) AS name, NULLIF(TRIM(level), '') AS level
       FROM classes
       WHERE tenant_id = $1 AND TRIM(COALESCE(class_name, '')) <> ''
       ORDER BY COALESCE(level_order, 999), COALESCE(level, ''), TRIM(class_name)`,
      [tenantId]
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      level: row.level ? String(row.level) : null,
    }));
  } catch {
    const result = await query(
      `SELECT id, TRIM(class_name) AS name
       FROM classes
       WHERE tenant_id = $1 AND TRIM(COALESCE(class_name, '')) <> ''
       ORDER BY TRIM(class_name)`,
      [tenantId]
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      level: null,
    }));
  }
}

export async function getAdminOverview(tenantId: number) {
  await ensureWebsiteRow(tenantId);
  const [siteRes, statsRes] = await Promise.all([
    query(
      `SELECT sw.*, t.name AS school_name, t.slug
       FROM school_websites sw
       JOIN tenants t ON t.id = sw.tenant_id
       WHERE sw.tenant_id = $1`,
      [tenantId]
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM school_website_gallery WHERE tenant_id = $1) AS gallery_count,
         (SELECT COUNT(*)::int FROM school_website_applications WHERE tenant_id = $1 AND status = 'pending') AS pending_applications`,
      [tenantId]
    ),
  ]);
  const site = siteRes.rows[0];
  const stats = statsRes.rows[0];
  return {
    ...mapWebsiteRow(site, site),
    gallery_count: Number(stats?.gallery_count || 0),
    pending_applications: Number(stats?.pending_applications || 0),
  };
}

export async function updateWebsiteSettings(
  tenantId: number,
  body: Partial<{
    is_enabled: boolean;
    is_published: boolean;
    accent_color: string;
    tagline: string;
    welcome_text: string;
    highlights: WebsiteHighlight[];
    stats: WebsiteStats;
    social_links: Record<string, string>;
    banner_image_url: string | null;
    welcome_image_url: string | null;
    welcome_image_secondary_url: string | null;
    home_content: WebsiteHomeContent;
    logo_url: string | null;
  }>
) {
  await ensureWebsiteRow(tenantId);
  const fields: string[] = [];
  const values: unknown[] = [tenantId];
  const set = (col: string, val: unknown) => {
    values.push(val);
    fields.push(`${col} = $${values.length}`);
  };

  if (body.is_enabled !== undefined) set('is_enabled', body.is_enabled);
  if (body.is_published !== undefined) set('is_published', body.is_published);
  if (body.accent_color !== undefined) set('accent_color', body.accent_color);
  if (body.tagline !== undefined) set('tagline', body.tagline);
  if (body.welcome_text !== undefined) set('welcome_text', body.welcome_text);
  if (body.highlights !== undefined) set('highlights', JSON.stringify(body.highlights));
  if (body.stats !== undefined) set('stats', JSON.stringify(body.stats));
  if (body.social_links !== undefined) set('social_links', JSON.stringify(body.social_links));
  if (body.banner_image_url !== undefined) set('banner_image_url', body.banner_image_url);
  if (body.welcome_image_url !== undefined) set('welcome_image_url', body.welcome_image_url);
  if (body.welcome_image_secondary_url !== undefined) set('welcome_image_secondary_url', body.welcome_image_secondary_url);
  if (body.home_content !== undefined) set('home_content', JSON.stringify(body.home_content));
  if (body.logo_url !== undefined) set('logo_url', body.logo_url);

  if (fields.length === 0) throw httpError(400, 'No fields to update');
  fields.push('updated_at = NOW()');

  await query(
    `UPDATE school_websites SET ${fields.join(', ')} WHERE tenant_id = $1`,
    values
  );
  return getAdminOverview(tenantId);
}

export async function getAboutContent(tenantId: number) {
  await ensureWebsiteRow(tenantId);
  const res = await query(`SELECT * FROM school_website_about WHERE tenant_id = $1`, [tenantId]);
  return res.rows[0] || {};
}

export async function updateAboutContent(tenantId: number, body: Record<string, unknown>) {
  await ensureWebsiteRow(tenantId);
  await query(
    `UPDATE school_website_about SET
       history = COALESCE($2, history),
       vision = COALESCE($3, vision),
       mission = COALESCE($4, mission),
       core_values = COALESCE($5, core_values),
       director_message = COALESCE($6, director_message),
       director_name = COALESCE($7, director_name),
       director_title = COALESCE($8, director_title),
       director_photo_url = COALESCE($9, director_photo_url),
       institution_overview = COALESCE($10, institution_overview),
       history_image_url = COALESCE($11, history_image_url),
       overview_image_url = COALESCE($12, overview_image_url),
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [
      tenantId,
      body.history ?? null,
      body.vision ?? null,
      body.mission ?? null,
      body.core_values != null ? JSON.stringify(body.core_values) : null,
      body.director_message ?? null,
      body.director_name ?? null,
      body.director_title ?? null,
      body.director_photo_url ?? null,
      body.institution_overview ?? null,
      body.history_image_url ?? null,
      body.overview_image_url ?? null,
    ]
  );
  return getAboutContent(tenantId);
}

export async function getAdmissionConfig(tenantId: number) {
  await ensureWebsiteRow(tenantId);
  const res = await query(`SELECT * FROM school_website_admission_config WHERE tenant_id = $1`, [tenantId]);
  return res.rows[0] || {};
}

export async function updateAdmissionConfig(tenantId: number, body: Record<string, unknown>) {
  await ensureWebsiteRow(tenantId);
  await query(
    `UPDATE school_website_admission_config SET
       requirements = COALESCE($2, requirements),
       programs = COALESCE($3, programs),
       applications_open = COALESCE($4, applications_open),
       open_date = COALESCE($5, open_date),
       close_date = COALESCE($6, close_date),
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [
      tenantId,
      body.requirements ?? null,
      body.programs != null ? JSON.stringify(body.programs) : null,
      body.applications_open ?? null,
      body.open_date ?? null,
      body.close_date ?? null,
    ]
  );
  return getAdmissionConfig(tenantId);
}

export async function getCareersConfig(tenantId: number) {
  await ensureWebsiteRow(tenantId);
  const res = await query(`SELECT * FROM school_website_careers_config WHERE tenant_id = $1`, [tenantId]);
  return res.rows[0] || { applications_open: true };
}

export async function updateCareersConfig(tenantId: number, body: Record<string, unknown>) {
  await ensureWebsiteRow(tenantId);
  await query(
    `UPDATE school_website_careers_config SET
       applications_open = COALESCE($2, applications_open),
       intro_text = COALESCE($3, intro_text),
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, body.applications_open ?? null, body.intro_text ?? null]
  );
  return getCareersConfig(tenantId);
}

export async function listApplications(tenantId: number) {
  const res = await query(
    `SELECT id, applicant_name, program_applied, status, submitted_at, parent_email, parent_phone
     FROM school_website_applications
     WHERE tenant_id = $1
     ORDER BY submitted_at DESC`,
    [tenantId]
  );
  return res.rows;
}

export async function getApplication(tenantId: number, id: number) {
  const res = await query(
    `SELECT * FROM school_website_applications WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Application not found');
  return res.rows[0];
}

function parseApplicationJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function parseApplicationDocuments(row: Record<string, unknown>, data: Record<string, unknown>): Array<Record<string, unknown>> {
  const rawDocs = row.documents ?? data.documents;
  if (Array.isArray(rawDocs)) return rawDocs as Array<Record<string, unknown>>;
  if (typeof rawDocs === 'string') {
    try {
      return JSON.parse(rawDocs) as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  }
  return [];
}

async function nextStudentIdentifiers(
  tenantId: number,
  bump = 0
): Promise<{ studentId: string; admissionNumber: string }> {
  const year = new Date().getFullYear();
  const yearShort = year.toString().slice(-2);

  const seqRes = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 5) AS INTEGER)), 0) AS mx
     FROM students
     WHERE tenant_id = $1 AND student_id ~ ('^' || $2 || '[0-9]{4}$')`,
    [tenantId, String(year)]
  );
  const seq = parseInt(seqRes.rows[0]?.mx || '0', 10) + 1 + bump;

  const admRes = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM 6) AS INTEGER)), 0) AS mx
     FROM students
     WHERE tenant_id = $1 AND admission_number ~ ('^ADM' || $2 || '[0-9]{3}$')`,
    [tenantId, yearShort]
  );
  const admSeq = parseInt(admRes.rows[0]?.mx || '0', 10) + 1 + bump;

  return {
    studentId: `${year}${seq.toString().padStart(4, '0')}`,
    admissionNumber: `ADM${yearShort}${admSeq.toString().padStart(3, '0')}`,
  };
}

async function resolveApplicationClassId(
  tenantId: number,
  row: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<number | null> {
  const directId = data.class_assigned_id ?? data.classAssignedId;
  if (directId != null && String(directId).trim() !== '') {
    const classId = Number(directId);
    if (Number.isFinite(classId) && classId > 0) return classId;
  }

  const className = String(row.program_applied || data.classAssigned || data.class_assigned || '').trim();
  if (!className) return null;

  const classRes = await query(
    `SELECT id FROM classes
     WHERE tenant_id = $1 AND LOWER(TRIM(class_name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [tenantId, className]
  );
  return classRes.rows[0]?.id ? Number(classRes.rows[0].id) : null;
}

async function createPendingStudentFromApplication(
  tenantId: number,
  row: Record<string, unknown>,
  audit?: { userId?: number | null; userRole?: string | null }
): Promise<number> {
  if (row.student_id) {
    const linked = await query(
      `SELECT id FROM students WHERE tenant_id = $1 AND id = $2`,
      [tenantId, row.student_id]
    );
    if (linked.rows[0]?.id) return Number(linked.rows[0].id);
  }

  const data = parseApplicationJson(row.application_data);
  let firstName = String(data.first_name || data.firstName || '').trim();
  let lastName = String(data.last_name || data.lastName || '').trim();
  if (!firstName && !lastName) {
    const parts = String(row.applicant_name || '').trim().split(/\s+/).filter(Boolean);
    firstName = parts[0] || 'Applicant';
    lastName = parts.slice(1).join(' ') || '—';
  }

  const documents = parseApplicationDocuments(row, data);
  const photoDoc = documents.find((doc) =>
    String(doc.label || doc.name || '').toLowerCase().includes('passport')
  );
  const passportPhotoUrl = photoDoc?.url ? String(photoDoc.url) : null;
  const classAssignedId = await resolveApplicationClassId(tenantId, row, data);
  const admissionTermId = await getActiveAcademicTermId(tenantId);
  const notesPrefix = `Website admission application #${row.id}`;
  const extraNotes = String(data.notes || '').trim();
  const notes = extraNotes ? `${notesPrefix}. ${extraNotes}` : notesPrefix;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { studentId, admissionNumber } = await nextStudentIdentifiers(tenantId, attempt);
    try {
      const result = await query(
        `INSERT INTO students (
          tenant_id, first_name, last_name, gender, date_of_birth, nationality,
          student_id, admission_number, class_assigned_id, guardian_name,
          guardian_contact, guardian_2_name, guardian_2_contact, guardian_2_relationship,
          home_address, number_of_siblings, names_of_siblings,
          previous_school, date_of_admission, notes, passport_photo_url,
          enrollment_status, admission_academic_term_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *`,
        [
          tenantId,
          firstName,
          lastName,
          row.gender || data.gender || null,
          row.dob || data.dateOfBirth || data.date_of_birth || null,
          row.nationality || data.nationality || null,
          studentId,
          admissionNumber,
          classAssignedId,
          row.parent_name || data.guardianName || data.guardian_name || null,
          row.parent_phone || data.guardianContact || data.guardian_contact || null,
          data.guardian2Name || data.guardian_2_name || null,
          data.guardian2Contact || data.guardian_2_contact || null,
          data.guardian2Relationship || data.guardian_2_relationship || row.relationship || null,
          data.homeAddress || data.home_address || null,
          Number(data.numberOfSiblings || data.number_of_siblings || 0) || 0,
          data.namesOfSiblings || data.names_of_siblings || null,
          data.previousSchool || data.previous_school || null,
          data.dateOfAdmission || data.date_of_admission || null,
          notes,
          passportPhotoUrl,
          'pending',
          admissionTermId,
        ]
      );

      const studentRow = result.rows[0];
      await query(
        `UPDATE school_website_applications SET student_id = $3
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, row.id, studentRow.id]
      );

      await writeAuditLog({
        tenantId,
        userId: audit?.userId ?? null,
        userRole: audit?.userRole ?? null,
        action: 'STUDENT_PENDING',
        entityType: 'STUDENT',
        entityId: Number(studentRow.id),
        module: 'academics',
        summary: `Saved pending admission from website application: ${firstName} ${lastName} (${admissionNumber})`,
        details: {
          websiteApplicationId: Number(row.id),
          studentId,
          admissionNumber,
          classAssignedId,
        },
        afterValues: studentRow,
      });

      try {
        const io = getIO();
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'student',
          action: 'created',
          at: Date.now(),
        });
      } catch {
        // socket optional
      }

      return Number(studentRow.id);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to create pending student from application');
}

export async function updateApplicationStatus(
  tenantId: number,
  id: number,
  status: ApplicationStatus,
  audit?: { userId?: number | null; userRole?: string | null }
) {
  const existingRes = await query(
    `SELECT * FROM school_website_applications WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (existingRes.rows.length === 0) throw httpError(404, 'Application not found');
  const existing = existingRes.rows[0];
  const priorStatus = String(existing.status || 'pending');

  const res = await query(
    `UPDATE school_website_applications SET status = $3
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, id, status]
  );
  const row = res.rows[0];

  if (status === 'accepted' && priorStatus !== 'accepted') {
    const studentId = await createPendingStudentFromApplication(tenantId, row, audit);
    const linked = await query(
      `SELECT * FROM school_website_applications WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return { ...linked.rows[0], pending_student_id: studentId };
  }

  return row;
}

export async function submitApplication(
  tenantId: number,
  body: Record<string, unknown>
) {
  await ensureWebsiteRow(tenantId);
  const configRes = await query(
    `SELECT applications_open, open_date, close_date FROM school_website_admission_config WHERE tenant_id = $1`,
    [tenantId]
  );
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (!siteRes.rows[0]?.is_enabled) throw httpError(403, 'Applications are not available');
  const cfg = configRes.rows[0];
  if (cfg && cfg.applications_open === false) throw httpError(403, 'Applications are currently closed');

  const today = new Date().toISOString().slice(0, 10);
  if (cfg?.open_date && String(cfg.open_date).slice(0, 10) > today) {
    throw httpError(403, 'Applications have not opened yet');
  }
  if (cfg?.close_date && String(cfg.close_date).slice(0, 10) < today) {
    throw httpError(403, 'Application period has ended');
  }

  if (!body.applicant_name || !String(body.applicant_name).trim()) {
    const first = String(body.first_name || body.firstName || '').trim();
    const last = String(body.last_name || body.lastName || '').trim();
    if (!first || !last) throw httpError(400, 'Applicant name is required');
    body.applicant_name = `${first} ${last}`.trim();
  }

  const applicationData = { ...body };
  delete applicationData.applicant_name;
  delete applicationData.dob;
  delete applicationData.gender;
  delete applicationData.nationality;
  delete applicationData.program_applied;
  delete applicationData.parent_name;
  delete applicationData.parent_phone;
  delete applicationData.parent_email;
  delete applicationData.relationship;
  delete applicationData.documents;

  const insert = await query(
    `INSERT INTO school_website_applications
       (tenant_id, applicant_name, dob, gender, nationality, program_applied,
        parent_name, parent_phone, parent_email, relationship, documents, application_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, submitted_at`,
    [
      tenantId,
      String(body.applicant_name).trim(),
      body.dob || body.date_of_birth || body.dateOfBirth || null,
      body.gender || null,
      body.nationality || null,
      body.program_applied || body.class_assigned || body.classAssigned || null,
      body.parent_name || body.guardian_name || body.guardianName || null,
      body.parent_phone || body.guardian_phone || body.guardianContact || null,
      body.parent_email || body.guardian_email || body.guardianEmail || null,
      body.relationship || body.guardian2_relationship || body.guardian2Relationship || null,
      JSON.stringify(normalizeSubmittedDocuments(body.documents)),
      JSON.stringify(applicationData),
    ]
  );
  emitWebsitePortalEvent(
    tenantId,
    'website-application',
    `New admission application from ${String(body.applicant_name).trim()}`
  );
  return insert.rows[0];
}

function emitWebsitePortalEvent(
  tenantId: number,
  entity:
    | 'website-application'
    | 'website-contact'
    | 'website-employment'
    | 'website-transcript'
    | 'website-testimonial',
  preview: string
) {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity,
      action: 'created',
      at: Date.now(),
    });
    io.to(`tenant:${tenantId}`).emit('new-website-portal-message', {
      type: entity,
      preview,
      tenantId,
    });
  } catch {
    // socket optional during tests
  }
}

export async function getWebsitePortalNotificationSummary(tenantId: number) {
  const res = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM school_website_applications WHERE tenant_id = $1 AND status = 'pending') AS pending_applications,
       (SELECT COUNT(*)::int FROM school_website_contact_messages WHERE tenant_id = $1 AND is_read = false) AS unread_contact_messages,
       (SELECT COUNT(*)::int FROM school_website_employment_applications WHERE tenant_id = $1 AND status = 'pending') AS pending_employment,
       (SELECT COUNT(*)::int FROM school_website_transcript_requests WHERE tenant_id = $1 AND is_read = false) AS unread_transcript_requests,
       (SELECT COUNT(*)::int FROM school_website_testimonial_submissions WHERE tenant_id = $1 AND is_read = false) AS unread_testimonials`,
    [tenantId]
  );
  const row = res.rows[0] || {};
  return {
    pending_applications: Number(row.pending_applications || 0),
    unread_contact_messages: Number(row.unread_contact_messages || 0),
    pending_employment: Number(row.pending_employment || 0),
    unread_transcript_requests: Number(row.unread_transcript_requests || 0),
    unread_testimonials: Number(row.unread_testimonials || 0),
    total:
      Number(row.pending_applications || 0) +
      Number(row.unread_contact_messages || 0) +
      Number(row.pending_employment || 0) +
      Number(row.unread_transcript_requests || 0) +
      Number(row.unread_testimonials || 0),
  };
}

export async function markContactMessagesRead(tenantId: number) {
  await query(
    `UPDATE school_website_contact_messages SET is_read = true WHERE tenant_id = $1 AND is_read = false`,
    [tenantId]
  );
  return { ok: true };
}

export async function submitEmploymentApplication(
  tenantId: number,
  body: Record<string, unknown>
) {
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (!siteRes.rows[0]?.is_enabled) throw httpError(403, 'Employment applications are not available');

  const cfgRes = await query(
    `SELECT applications_open FROM school_website_careers_config WHERE tenant_id = $1`,
    [tenantId]
  );
  if (cfgRes.rows[0]?.applications_open === false) {
    throw httpError(403, 'Career applications are currently closed');
  }

  const fullName = String(body.full_name || body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  if (!fullName || !phone || !message) {
    throw httpError(400, 'Name, phone, and message are required');
  }

  const insert = await query(
    `INSERT INTO school_website_employment_applications
       (tenant_id, full_name, email, phone, position_applied, message, documents)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, submitted_at`,
    [
      tenantId,
      fullName,
      email || '',
      phone,
      body.position_applied || body.positionApplied ? String(body.position_applied || body.positionApplied).trim() : null,
      message,
      JSON.stringify(normalizeSubmittedDocuments(body.documents)),
    ]
  );
  emitWebsitePortalEvent(tenantId, 'website-employment', `${fullName} applied for a teaching position`);
  return insert.rows[0];
}

export async function listEmploymentApplications(tenantId: number) {
  const res = await query(
    `SELECT id, full_name, email, phone, position_applied, message, documents, status, submitted_at
     FROM school_website_employment_applications
     WHERE tenant_id = $1
     ORDER BY submitted_at DESC, id DESC`,
    [tenantId]
  );
  return res.rows;
}

export async function updateEmploymentApplicationStatus(
  tenantId: number,
  id: number,
  status: ApplicationStatus
) {
  const res = await query(
    `UPDATE school_website_employment_applications SET status = $3
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, status`,
    [tenantId, id, status]
  );
  if (res.rows.length === 0) throw httpError(404, 'Application not found');
  return res.rows[0];
}

export async function listGallery(tenantId: number) {
  const res = await query(
    `SELECT id, url, thumbnail_url, category, sort_order, uploaded_at
     FROM school_website_gallery WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );
  return res.rows;
}

export async function addGalleryImage(
  tenantId: number,
  url: string,
  category: string,
  thumbnailUrl?: string | null
) {
  const maxRes = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM school_website_gallery WHERE tenant_id = $1`,
    [tenantId]
  );
  const sortOrder = Number(maxRes.rows[0]?.next_order || 0);
  const insert = await query(
    `INSERT INTO school_website_gallery (tenant_id, url, thumbnail_url, category, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tenantId, url, thumbnailUrl || url, category, sortOrder]
  );
  return insert.rows[0];
}

export async function deleteGalleryImage(tenantId: number, id: number) {
  const res = await query(
    `DELETE FROM school_website_gallery WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Image not found');
  return { ok: true };
}

export async function reorderGallery(tenantId: number, orderedIds: number[]) {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await query(
      `UPDATE school_website_gallery SET sort_order = $3 WHERE tenant_id = $1 AND id = $2`,
      [tenantId, orderedIds[i], i]
    );
  }
  return listGallery(tenantId);
}

function mapEventRow(row: Record<string, unknown>): WebsiteEvent {
  let galleryImages: WebsiteEventImage[] = [];
  const raw = row.gallery_images;
  if (Array.isArray(raw)) {
    galleryImages = raw as WebsiteEventImage[];
  } else if (typeof raw === 'string') {
    try {
      galleryImages = JSON.parse(raw) as WebsiteEventImage[];
    } catch {
      galleryImages = [];
    }
  }

  const eventDate = row.event_date instanceof Date
    ? row.event_date.toISOString().slice(0, 10)
    : String(row.event_date || '').slice(0, 10);

  let eventTime: string | null = null;
  if (row.event_time) {
    const t = String(row.event_time);
    eventTime = t.length >= 5 ? t.slice(0, 5) : t;
  }

  return {
    id: Number(row.id),
    title: String(row.title),
    description: (row.description as string) || null,
    event_date: eventDate,
    event_time: eventTime,
    location: (row.location as string) || null,
    cover_image_url: (row.cover_image_url as string) || null,
    gallery_images: galleryImages,
    is_published: row.is_published !== false,
    sort_order: Number(row.sort_order || 0),
  };
}

export async function listEvents(tenantId: number) {
  const res = await query(
    `SELECT * FROM school_website_events
     WHERE tenant_id = $1
     ORDER BY event_date DESC, sort_order ASC, id DESC`,
    [tenantId]
  );
  return res.rows.map((row) => mapEventRow(row));
}

export async function createEvent(tenantId: number, body: Record<string, unknown>) {
  const title = String(body.title || '').trim();
  const eventDate = String(body.event_date || '').slice(0, 10);
  if (!title || !eventDate) throw httpError(400, 'Title and event date are required');

  const maxRes = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM school_website_events WHERE tenant_id = $1`,
    [tenantId]
  );
  const sortOrder = Number(maxRes.rows[0]?.next_order || 0);

  const insert = await query(
    `INSERT INTO school_website_events (
       tenant_id, title, description, event_date, event_time, location,
       cover_image_url, gallery_images, is_published, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      tenantId,
      title,
      body.description ? String(body.description) : null,
      eventDate,
      body.event_time || null,
      body.location ? String(body.location) : null,
      body.cover_image_url || null,
      JSON.stringify(Array.isArray(body.gallery_images) ? body.gallery_images : []),
      body.is_published !== false,
      sortOrder,
    ]
  );
  return mapEventRow(insert.rows[0]);
}

export async function updateEvent(tenantId: number, id: number, body: Record<string, unknown>) {
  const existing = await query(
    `SELECT id FROM school_website_events WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (existing.rows.length === 0) throw httpError(404, 'Event not found');

  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  if (title !== undefined && !title) throw httpError(400, 'Title is required');

  const res = await query(
    `UPDATE school_website_events SET
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       event_date = COALESCE($5, event_date),
       event_time = COALESCE($6, event_time),
       location = COALESCE($7, location),
       cover_image_url = COALESCE($8, cover_image_url),
       gallery_images = COALESCE($9::jsonb, gallery_images),
       is_published = COALESCE($10, is_published),
       updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [
      tenantId,
      id,
      title ?? null,
      body.description !== undefined ? (body.description ? String(body.description) : null) : null,
      body.event_date !== undefined ? String(body.event_date).slice(0, 10) : null,
      body.event_time !== undefined ? body.event_time || null : null,
      body.location !== undefined ? (body.location ? String(body.location) : null) : null,
      body.cover_image_url !== undefined ? body.cover_image_url || null : null,
      body.gallery_images !== undefined ? JSON.stringify(body.gallery_images || []) : null,
      body.is_published !== undefined ? !!body.is_published : null,
    ]
  );
  return mapEventRow(res.rows[0]);
}

export async function deleteEvent(tenantId: number, id: number) {
  const res = await query(
    `DELETE FROM school_website_events WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Event not found');
  return { ok: true };
}

export async function getContactInfo(tenantId: number) {
  await ensureWebsiteRow(tenantId);
  const res = await query(`SELECT * FROM school_website_contact WHERE tenant_id = $1`, [tenantId]);
  return res.rows[0] || {};
}

export async function updateContactInfo(tenantId: number, body: Record<string, unknown>) {
  await ensureWebsiteRow(tenantId);
  await query(
    `UPDATE school_website_contact SET
       primary_phone = COALESCE($2, primary_phone),
       secondary_phone = COALESCE($3, secondary_phone),
       email = COALESCE($4, email),
       address = COALESCE($5, address),
       map_embed_url = COALESCE($6, map_embed_url),
       working_hours = COALESCE($7, working_hours),
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [
      tenantId,
      body.primary_phone ?? null,
      body.secondary_phone ?? null,
      body.email ?? null,
      body.address ?? null,
      body.map_embed_url ?? null,
      body.working_hours ?? null,
    ]
  );
  return getContactInfo(tenantId);
}

export async function listContactMessages(tenantId: number) {
  const res = await query(
    `SELECT id, name, email, phone, message, is_read, created_at
     FROM school_website_contact_messages
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId]
  );
  return res.rows;
}

export async function markContactMessageRead(tenantId: number, id: number) {
  const res = await query(
    `UPDATE school_website_contact_messages SET is_read = true
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, is_read`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Message not found');
  return res.rows[0];
}

export async function submitContactMessage(
  tenantId: number,
  body: { name: string; phone: string; email?: string; message: string }
) {
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (!siteRes.rows[0]?.is_enabled) throw httpError(403, 'Contact form unavailable');

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const message = String(body.message || '').trim();
  const email = String(body.email || '').trim();

  if (!name || !phone || !message) {
    throw httpError(400, 'Name, phone, and message are required');
  }

  const insert = await query(
    `INSERT INTO school_website_contact_messages (tenant_id, name, phone, email, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, name, phone, email || null, message]
  );
  emitWebsitePortalEvent(
    tenantId,
    'website-contact',
    `Contact message from ${name}`
  );
  return { ok: true, id: insert.rows[0]?.id };
}

export async function submitTranscriptRequest(
  tenantId: number,
  body: Record<string, unknown>
) {
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (!siteRes.rows[0]?.is_enabled) throw httpError(403, 'Requests are not available');

  const fullName = String(body.full_name || body.fullName || '').trim();
  const completionYear = String(body.completion_year || body.completionYear || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const notes = String(body.notes || '').trim();
  const docType = String(body.document_type || body.documentType || 'transcript').toLowerCase();
  const documentType = ['transcript', 'bece', 'both', 'testimonial'].includes(docType) ? docType : 'transcript';

  if (!fullName || !completionYear || !phone) {
    throw httpError(400, 'Name, year of completion, and phone are required');
  }

  const insert = await query(
    `INSERT INTO school_website_transcript_requests
       (tenant_id, full_name, completion_year, phone, email, document_type, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [tenantId, fullName, completionYear, phone, email || null, documentType, notes || null]
  );
  const docLabels: Record<string, string> = {
    transcript: 'Transcript',
    bece: 'BECE results',
    both: 'Transcript & BECE',
    testimonial: 'Testimonial letter',
  };
  emitWebsitePortalEvent(
    tenantId,
    'website-transcript',
    `${docLabels[documentType] || 'Document'} request from ${fullName} (${completionYear})`
  );
  return { ok: true, id: insert.rows[0]?.id };
}

export async function submitTestimonial(
  tenantId: number,
  body: Record<string, unknown>
) {
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (!siteRes.rows[0]?.is_enabled) throw httpError(403, 'Testimonial letter requests are not available');

  const fullName = String(body.full_name || body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const notes = String(body.notes || body.message || '').trim();
  const completionYear = String(body.completion_year || body.completionYear || '').trim();
  const email = String(body.email || '').trim();

  if (!fullName || !completionYear || !phone) {
    throw httpError(400, 'Name, year of completion, and phone are required');
  }

  const insert = await query(
    `INSERT INTO school_website_testimonial_submissions
       (tenant_id, full_name, completion_year, phone, email, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      tenantId,
      fullName,
      completionYear,
      phone,
      email || null,
      notes || '',
    ]
  );
  emitWebsitePortalEvent(
    tenantId,
    'website-testimonial',
    `Testimonial letter request from ${fullName} (${completionYear})`
  );
  return { ok: true, id: insert.rows[0]?.id };
}

export async function listTranscriptRequests(tenantId: number) {
  const res = await query(
    `SELECT id, full_name, completion_year, phone, email, document_type, notes, status, is_read, created_at
     FROM school_website_transcript_requests
     WHERE tenant_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [tenantId]
  );
  return res.rows;
}

export async function listTestimonialSubmissions(tenantId: number) {
  const res = await query(
    `SELECT id, full_name, completion_year, phone, email, message, status, is_read, created_at
     FROM school_website_testimonial_submissions
     WHERE tenant_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [tenantId]
  );
  return res.rows;
}

export async function markTranscriptRequestRead(tenantId: number, id: number) {
  const res = await query(
    `UPDATE school_website_transcript_requests SET is_read = true
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, is_read`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Request not found');
  return res.rows[0];
}

export async function markTestimonialRead(tenantId: number, id: number) {
  const res = await query(
    `UPDATE school_website_testimonial_submissions SET is_read = true
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, is_read`,
    [tenantId, id]
  );
  if (res.rows.length === 0) throw httpError(404, 'Testimonial not found');
  return res.rows[0];
}

export async function updateTranscriptRequestStatus(
  tenantId: number,
  id: number,
  status: string
) {
  if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
    throw httpError(400, 'Invalid status');
  }
  const res = await query(
    `UPDATE school_website_transcript_requests SET status = $3, is_read = true
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, id, status]
  );
  if (res.rows.length === 0) throw httpError(404, 'Request not found');
  return res.rows[0];
}

export async function updateTestimonialStatus(tenantId: number, id: number, status: string) {
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw httpError(400, 'Invalid status');
  }
  const res = await query(
    `UPDATE school_website_testimonial_submissions SET status = $3, is_read = true
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, id, status]
  );
  if (res.rows.length === 0) throw httpError(404, 'Testimonial not found');
  return res.rows[0];
}

export async function listSuperAdminWebsiteEnableRequests() {
  const res = await query(
    `SELECT r.id, r.tenant_id, r.requested_by_name, r.message, r.status, r.created_at,
            t.name AS tenant_name, t.slug AS tenant_slug
     FROM school_website_enable_requests r
     JOIN tenants t ON t.id = r.tenant_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC`
  );
  return res.rows;
}

export async function listSuperAdminWebsites() {
  const res = await query(
    `SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug,
            COALESCE(NULLIF(TRIM(sw.website_url_suffix), ''), 'edu') AS website_url_suffix,
            sw.public_subdomain,
            COALESCE(sw.is_enabled, false) AS is_enabled,
            COALESCE(sw.is_published, false) AS is_published,
            sw.updated_at,
            (SELECT COUNT(*)::int FROM school_website_applications a
             WHERE a.tenant_id = t.id AND a.status = 'pending') AS pending_applications,
            (SELECT COUNT(*)::int FROM school_website_gallery g WHERE g.tenant_id = t.id) AS gallery_count
     FROM tenants t
     LEFT JOIN school_websites sw ON sw.tenant_id = t.id
     WHERE t.is_active = true AND t.archived_at IS NULL
     ORDER BY t.name ASC`
  );
  return res.rows.map((row) => {
    const tenantSlug = String(row.slug || '');
    const publicSubdomain = (row.public_subdomain as string | null) || null;
    const suffix = normalizeWebsiteUrlSuffix(String(row.website_url_suffix || DEFAULT_WEBSITE_URL_SUFFIX));
    const urls = getSchoolUrls(tenantSlug, suffix, publicSubdomain);
    const effectivePublicSlug = getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain);
    return {
      ...row,
      website_url_suffix: suffix,
      public_site_url: buildSchoolWebsitePublicUrl(tenantSlug, suffix, { publicSubdomain }),
      portal_url: `https://${urls.portal}`,
      effective_public_subdomain: effectivePublicSlug,
    };
  });
}

export async function superAdminSetWebsiteUrlSuffix(tenantId: number, rawSuffix: string) {
  await ensureWebsiteRow(tenantId);

  const validationError = validateWebsiteUrlSuffix(rawSuffix);
  if (validationError) throw httpError(400, validationError);

  const suffix = normalizeWebsiteUrlSuffix(rawSuffix) || DEFAULT_WEBSITE_URL_SUFFIX;

  const tenantRes = await query(`SELECT slug FROM tenants WHERE id = $1`, [tenantId]);
  const tenantSlug = String(tenantRes.rows[0]?.slug || '');

  await query(
    `UPDATE school_websites SET website_url_suffix = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, suffix]
  );

  const siteRes = await query(`SELECT public_subdomain FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  const publicSubdomain = (siteRes.rows[0]?.public_subdomain as string | null) || null;
  const urls = getSchoolUrls(tenantSlug, suffix, publicSubdomain);
  return {
    tenant_id: tenantId,
    slug: tenantSlug,
    website_url_suffix: suffix,
    public_site_url: buildSchoolWebsitePublicUrl(tenantSlug, suffix, { publicSubdomain }),
    portal_url: `https://${urls.portal}`,
    effective_public_subdomain: getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain),
  };
}

export async function superAdminSetWebsitePublicSlug(tenantId: number, rawSubdomain: string | null) {
  await ensureWebsiteRow(tenantId);

  const tenantRes = await query(`SELECT slug FROM tenants WHERE id = $1`, [tenantId]);
  const tenantSlug = String(tenantRes.rows[0]?.slug || '');

  const trimmed = String(rawSubdomain || '').trim();
  let stored: string | null = null;

  if (trimmed) {
    const normalized = normalizePublicWebsiteSlug(trimmed);
    const validationError = validatePublicWebsiteSlug(normalized);
    if (validationError) throw httpError(400, validationError);

    if (normalized !== normalizePublicWebsiteSlug(tenantSlug)) {
      const conflict = await query(
        `SELECT sw.tenant_id
         FROM school_websites sw
         JOIN tenants t ON t.id = sw.tenant_id
         WHERE sw.tenant_id <> $1
           AND LOWER(COALESCE(NULLIF(TRIM(sw.public_subdomain), ''), t.slug)) = LOWER($2)
         LIMIT 1`,
        [tenantId, normalized]
      );
      if (conflict.rows.length > 0) {
        throw httpError(409, 'This public website slug is already used by another school');
      }
      stored = normalized;
    }
  }

  await query(
    `UPDATE school_websites SET public_subdomain = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, stored]
  );

  const suffixRes = await query(
    `SELECT COALESCE(NULLIF(TRIM(website_url_suffix), ''), 'edu') AS website_url_suffix
     FROM school_websites WHERE tenant_id = $1`,
    [tenantId]
  );
  const suffix = normalizeWebsiteUrlSuffix(String(suffixRes.rows[0]?.website_url_suffix || DEFAULT_WEBSITE_URL_SUFFIX));
  const urls = getSchoolUrls(tenantSlug, suffix, stored);

  return {
    tenant_id: tenantId,
    slug: tenantSlug,
    public_subdomain: stored,
    effective_public_subdomain: getEffectivePublicWebsiteSlug(tenantSlug, stored),
    website_url_suffix: suffix,
    public_site_url: buildSchoolWebsitePublicUrl(tenantSlug, suffix, { publicSubdomain: stored }),
    portal_url: `https://${urls.portal}`,
  };
}

export async function superAdminSetWebsiteSubdomain(tenantId: number, rawSubdomain: string | null) {
  return superAdminSetWebsitePublicSlug(tenantId, rawSubdomain);
}

export async function requestWebsiteEnable(
  tenantId: number,
  user: { id?: number; username?: string; full_name?: string },
  message?: string
) {
  await ensureWebsiteRow(tenantId);
  const siteRes = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  if (siteRes.rows[0]?.is_enabled) {
    throw httpError(400, 'Website feature is already enabled for your school');
  }

  const tenantRes = await query(`SELECT name, slug FROM tenants WHERE id = $1`, [tenantId]);
  const schoolName = String(tenantRes.rows[0]?.name || 'School').trim();
  const requester = String(user.full_name || user.username || 'School admin').trim();
  const body =
    String(message || '').trim() ||
    `Please enable the School Website feature for ${schoolName}.`;

  const recent = await query(
    `SELECT id FROM school_website_enable_requests
     WHERE tenant_id = $1 AND status = 'pending'
       AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [tenantId]
  );
  if (recent.rows.length > 0) {
    throw httpError(429, 'A request was already sent recently. ScholarNerve will respond soon.');
  }

  const insert = await query(
    `INSERT INTO school_website_enable_requests
       (tenant_id, requested_by_user_id, requested_by_name, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [tenantId, user.id ?? null, requester, body]
  );

  try {
    const io = getIO();
    io.to('global:super-admin').emit('website-enable-request', {
      id: insert.rows[0]?.id,
      tenantId,
      schoolName,
      requester,
      message: body,
      at: Date.now(),
    });
    io.to('global:super-admin').emit('tenant-data-changed', {
      tenantId,
      entity: 'website-enable-request',
      action: 'created',
      at: Date.now(),
    });
  } catch {
    // socket optional
  }

  void notifySuperAdminsOfSupportMessage({
    title: `${schoolName} — Website activation request`,
    body: `${requester}: ${body.slice(0, 140)}`,
    url: '/?module=super-admin-websites',
  }).catch(() => {});

  return { ok: true, id: insert.rows[0]?.id, created_at: insert.rows[0]?.created_at };
}

export async function superAdminSetWebsiteEnabled(tenantId: number, enabled: boolean) {
  await ensureWebsiteRow(tenantId);
  await query(
    `UPDATE school_websites SET is_enabled = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, enabled]
  );
  if (enabled) {
    await query(
      `UPDATE school_website_enable_requests SET status = 'handled'
       WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId]
    );
  }
  return { tenant_id: tenantId, is_enabled: enabled };
}

export async function superAdminWebsiteStats() {
  const res = await query(
    `SELECT
       COUNT(*) FILTER (WHERE is_enabled)::int AS active_sites,
       (SELECT COUNT(*)::int FROM school_website_applications WHERE status = 'pending') AS pending_applications,
       (SELECT COUNT(*)::int FROM school_website_enable_requests WHERE status = 'pending') AS pending_enable_requests
     FROM school_websites`
  );
  return res.rows[0] || { active_sites: 0, pending_applications: 0, pending_enable_requests: 0 };
}

export async function isWebsiteFeatureEnabled(tenantId: number): Promise<boolean> {
  const res = await query(`SELECT is_enabled FROM school_websites WHERE tenant_id = $1`, [tenantId]);
  return !!res.rows[0]?.is_enabled;
}

export type WebsiteTeamMemberType = 'leadership' | 'teacher';

function mapTeamMemberRow(row: Record<string, unknown>) {
  let subjects: string[] = [];
  const raw = row.subjects;
  if (Array.isArray(raw)) subjects = raw.map(String);
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) subjects = parsed.map(String);
    } catch {
      subjects = [];
    }
  }
  return {
    id: Number(row.id),
    member_type: String(row.member_type || 'leadership') as WebsiteTeamMemberType,
    position: String(row.position || 'other'),
    full_name: String(row.full_name || ''),
    photo_url: (row.photo_url as string | null) || null,
    bio: (row.bio as string | null) || null,
    subjects,
    sort_order: Number(row.sort_order || 0),
    is_published: row.is_published !== false,
  };
}

function mapAlumniProfileRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    full_name: String(row.full_name || ''),
    graduation_year: (row.graduation_year as string | null) || null,
    photo_url: (row.photo_url as string | null) || null,
    achievement: (row.achievement as string | null) || null,
    testimonial: (row.testimonial as string | null) || null,
    sort_order: Number(row.sort_order || 0),
    is_published: row.is_published !== false,
  };
}

async function listTeamMembersInternal(tenantId: number, publishedOnly: boolean) {
  const res = await query(
    `SELECT id, member_type, position, full_name, photo_url, bio, subjects, sort_order, is_published
     FROM school_website_team_members
     WHERE tenant_id = $1 ${publishedOnly ? 'AND is_published = true' : ''}
     ORDER BY member_type ASC, sort_order ASC, id ASC`,
    [tenantId]
  );
  return res.rows.map((row) => mapTeamMemberRow(row));
}

async function listAlumniProfilesInternal(tenantId: number, publishedOnly: boolean) {
  const res = await query(
    `SELECT id, full_name, graduation_year, photo_url, achievement, testimonial, sort_order, is_published
     FROM school_website_alumni_profiles
     WHERE tenant_id = $1 ${publishedOnly ? 'AND is_published = true' : ''}
     ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );
  return res.rows.map((row) => mapAlumniProfileRow(row));
}

export async function listTeamMembers(tenantId: number) {
  return listTeamMembersInternal(tenantId, false);
}

export async function listPublicTeamMembers(tenantId: number) {
  return listTeamMembersInternal(tenantId, true);
}

export async function createTeamMember(tenantId: number, body: Record<string, unknown>) {
  const memberType = String(body.member_type || 'leadership') === 'teacher' ? 'teacher' : 'leadership';
  const fullName = String(body.full_name || '').trim();
  if (!fullName) throw httpError(400, 'Name is required');
  const maxRes = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM school_website_team_members WHERE tenant_id = $1 AND member_type = $2`,
    [tenantId, memberType]
  );
  const sortOrder = Number(maxRes.rows[0]?.next_order || 0);
  const subjects = Array.isArray(body.subjects) ? body.subjects.map(String) : [];
  const insert = await query(
    `INSERT INTO school_website_team_members
       (tenant_id, member_type, position, full_name, photo_url, bio, subjects, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      tenantId,
      memberType,
      String(body.position || 'other').trim() || 'other',
      fullName,
      body.photo_url ? String(body.photo_url) : null,
      body.bio ? String(body.bio).trim() : null,
      JSON.stringify(subjects),
      sortOrder,
      body.is_published !== false,
    ]
  );
  return mapTeamMemberRow(insert.rows[0]);
}

export async function updateTeamMember(tenantId: number, id: number, body: Record<string, unknown>) {
  const existing = await query(
    `SELECT id FROM school_website_team_members WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (!existing.rows.length) throw httpError(404, 'Team member not found');
  const subjects = Array.isArray(body.subjects) ? body.subjects.map(String) : undefined;
  const res = await query(
    `UPDATE school_website_team_members SET
       member_type = COALESCE($3, member_type),
       position = COALESCE($4, position),
       full_name = COALESCE($5, full_name),
       photo_url = CASE WHEN $6::boolean THEN $7 ELSE photo_url END,
       bio = CASE WHEN $8::boolean THEN $9 ELSE bio END,
       subjects = COALESCE($10, subjects),
       sort_order = COALESCE($11, sort_order),
       is_published = COALESCE($12, is_published),
       updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [
      tenantId,
      id,
      body.member_type ? (String(body.member_type) === 'teacher' ? 'teacher' : 'leadership') : null,
      body.position != null ? String(body.position).trim() || 'other' : null,
      body.full_name != null ? String(body.full_name).trim() : null,
      body.photo_url !== undefined,
      body.photo_url ? String(body.photo_url) : null,
      body.bio !== undefined,
      body.bio ? String(body.bio).trim() : null,
      subjects != null ? JSON.stringify(subjects) : null,
      body.sort_order != null ? Number(body.sort_order) : null,
      body.is_published != null ? body.is_published !== false : null,
    ]
  );
  return mapTeamMemberRow(res.rows[0]);
}

export async function deleteTeamMember(tenantId: number, id: number) {
  const res = await query(
    `DELETE FROM school_website_team_members WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  if (!res.rows.length) throw httpError(404, 'Team member not found');
  return { ok: true };
}

export async function listAlumniProfiles(tenantId: number) {
  return listAlumniProfilesInternal(tenantId, false);
}

export async function listPublicAlumniProfiles(tenantId: number) {
  return listAlumniProfilesInternal(tenantId, true);
}

export async function createAlumniProfile(tenantId: number, body: Record<string, unknown>) {
  const fullName = String(body.full_name || '').trim();
  if (!fullName) throw httpError(400, 'Name is required');
  const maxRes = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM school_website_alumni_profiles WHERE tenant_id = $1`,
    [tenantId]
  );
  const sortOrder = Number(maxRes.rows[0]?.next_order || 0);
  const insert = await query(
    `INSERT INTO school_website_alumni_profiles
       (tenant_id, full_name, graduation_year, photo_url, achievement, testimonial, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      tenantId,
      fullName,
      body.graduation_year ? String(body.graduation_year).trim() : null,
      body.photo_url ? String(body.photo_url) : null,
      body.bio || body.achievement ? String(body.achievement || body.bio).trim() : null,
      body.testimonial ? String(body.testimonial).trim() : null,
      sortOrder,
      body.is_published !== false,
    ]
  );
  return mapAlumniProfileRow(insert.rows[0]);
}

export async function updateAlumniProfile(tenantId: number, id: number, body: Record<string, unknown>) {
  const existing = await query(
    `SELECT id FROM school_website_alumni_profiles WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (!existing.rows.length) throw httpError(404, 'Alumni profile not found');
  const res = await query(
    `UPDATE school_website_alumni_profiles SET
       full_name = COALESCE($3, full_name),
       graduation_year = CASE WHEN $4::boolean THEN $5 ELSE graduation_year END,
       photo_url = CASE WHEN $6::boolean THEN $7 ELSE photo_url END,
       achievement = CASE WHEN $8::boolean THEN $9 ELSE achievement END,
       testimonial = CASE WHEN $10::boolean THEN $11 ELSE testimonial END,
       sort_order = COALESCE($12, sort_order),
       is_published = COALESCE($13, is_published),
       updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [
      tenantId,
      id,
      body.full_name != null ? String(body.full_name).trim() : null,
      body.graduation_year !== undefined,
      body.graduation_year ? String(body.graduation_year).trim() : null,
      body.photo_url !== undefined,
      body.photo_url ? String(body.photo_url) : null,
      body.achievement !== undefined || body.bio !== undefined,
      body.achievement || body.bio ? String(body.achievement || body.bio).trim() : null,
      body.testimonial !== undefined,
      body.testimonial ? String(body.testimonial).trim() : null,
      body.sort_order != null ? Number(body.sort_order) : null,
      body.is_published != null ? body.is_published !== false : null,
    ]
  );
  return mapAlumniProfileRow(res.rows[0]);
}

export async function deleteAlumniProfile(tenantId: number, id: number) {
  const res = await query(
    `DELETE FROM school_website_alumni_profiles WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  if (!res.rows.length) throw httpError(404, 'Alumni profile not found');
  return { ok: true };
}
