import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';
import { resolveSchoolDisplayName } from './schoolBrandingService.js';

function generatePin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export type TeacherPortalAccess = {
  username: string;
  temporaryPassword: string;
  portalSlug: string | null;
  tenantId: number;
  mustChangePassword: boolean;
  instructions: string;
};

export type AppointmentLetterConfig = {
  signatoryName?: string;
  signatoryTitle?: string;
  workingHours?: string;
  leaveEntitlement?: string;
  noticePeriod?: string;
  probationPeriod?: string;
  bodyOpening?: string;
  bodyClosing?: string;
  customClauses?: string[];
  stampImage?: string | null;
};

export const DEFAULT_BODY_OPENING =
  'We are pleased to offer you employment at [SCHOOL] under the following terms and conditions:';

export const DEFAULT_BODY_CLOSING =
  'Please sign and return a copy of this letter to indicate your acceptance of these terms.';

export function applySchoolPlaceholder(text: string, schoolName: string): string {
  return text.replace(/\[SCHOOL\]/g, schoolName);
}

export function schoolInitials(schoolName: string): string {
  const words = schoolName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'SC';
}

export async function getAppointmentLetterConfig(tenantId: number): Promise<AppointmentLetterConfig> {
  const res = await query(
    `SELECT appointment_letter_config FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const raw = res.rows[0]?.appointment_letter_config;
  if (!raw || typeof raw !== 'object') return {};
  return raw as AppointmentLetterConfig;
}

export async function saveAppointmentLetterConfig(tenantId: number, config: AppointmentLetterConfig) {
  await query(
    `UPDATE school_settings SET appointment_letter_config = $1::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2`,
    [JSON.stringify(config), tenantId]
  );
}

export function configIsComplete(config: AppointmentLetterConfig): boolean {
  return !!(
    config.signatoryName?.trim() &&
    config.signatoryTitle?.trim() &&
    config.workingHours?.trim() &&
    config.leaveEntitlement?.trim() &&
    config.noticePeriod?.trim() &&
    config.probationPeriod?.trim()
  );
}

const TEACHER_CLASS_SQL = `
  COALESCE(
    NULLIF((
      SELECT STRING_AGG(DISTINCT cl.class_name, ', ' ORDER BY cl.class_name)
      FROM class_teachers ct2
      JOIN classes cl ON cl.id = ct2.class_id AND cl.tenant_id = ct2.tenant_id
      WHERE ct2.teacher_id = t.id AND ct2.tenant_id = t.tenant_id
    ), ''),
    c.class_name
  )
`;

function deriveDepartment(className: string, subjects: string[]): string {
  if (subjects.length > 0) return subjects.join(', ');
  if (className?.trim()) return className.trim();
  return 'Academic';
}

export async function validateLetterPrerequisites(tenantId: number, teacherId: number) {
  const teacherRes = await query(
    `SELECT t.*, ${TEACHER_CLASS_SQL} AS class_name
     FROM teachers t
     LEFT JOIN classes c ON c.id = t.class_assigned_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [teacherId, tenantId]
  );
  const teacher = teacherRes.rows[0];
  const config = await getAppointmentLetterConfig(tenantId);
  const checklist: Array<{ label: string; ok: boolean }> = [];

  checklist.push({ label: 'Teacher full name', ok: !!teacher?.full_name?.trim() });
  checklist.push({ label: 'Employment start date', ok: !!teacher?.employment_date });
  checklist.push({
    label: 'Monthly salary set',
    ok: teacher?.monthly_salary != null && Number(teacher.monthly_salary) > 0,
  });
  const hasAssignment =
    !!teacher?.class_name?.trim() ||
    (Array.isArray(teacher?.subjects_taught) && teacher.subjects_taught.length > 0);
  checklist.push({ label: 'Class or subject assigned', ok: hasAssignment });
  checklist.push({ label: 'Appointment letter settings configured', ok: configIsComplete(config) });

  return { teacher, config, checklist, ready: checklist.every((c) => c.ok) };
}

export async function buildLetterContent(tenantId: number, teacherId: number) {
  const { teacher, config, checklist, ready } = await validateLetterPrerequisites(tenantId, teacherId);
  if (!ready || !teacher) {
    return { ready: false, checklist, letter: null };
  }

  const settingsRes = await query(
    `SELECT ss.school_name, ss.address, ss.email, ss.phone_number, ss.contact_phone,
            COALESCE(NULLIF(ss.logo_url, ''), t.logo_url) AS logo_url,
            ss.physical_address, ss.postal_address, t.slug, t.subdomain
     FROM school_settings ss
     JOIN tenants t ON t.id = ss.tenant_id
     WHERE ss.tenant_id = $1`,
    [tenantId]
  );
  const school = settingsRes.rows[0] || {};
  const schoolName = await resolveSchoolDisplayName(tenantId);

  const versionRes = await query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM teacher_appointment_letters WHERE tenant_id = $1 AND teacher_id = $2`,
    [tenantId, teacherId]
  );
  const versionNumber = Number(versionRes.rows[0]?.next_version || 1);
  const generatedDate = new Date().toISOString().slice(0, 10);

  const subjects = Array.isArray(teacher.subjects_taught) ? teacher.subjects_taught : [];
  const positionTitle = teacher.class_name
    ? `Class Teacher — ${teacher.class_name}`
    : subjects.length > 0
      ? `Subject Teacher — ${subjects.join(', ')}`
      : 'Teacher';
  const department = deriveDepartment(teacher.class_name || '', subjects);
  const employmentType = String(teacher.employment_type || '').trim() || 'Permanent';

  const rawOpening = config.bodyOpening?.trim() || DEFAULT_BODY_OPENING;
  const rawClosing = config.bodyClosing?.trim() || DEFAULT_BODY_CLOSING;

  const letter = {
    referenceNumber: null as string | null,
    versionNumber,
    generatedDate,
    letterDate: generatedDate,
    school: {
      name: schoolName,
      address: school.physical_address || school.address || school.postal_address || '',
      phone: school.phone_number || school.contact_phone || '',
      email: school.email || '',
      logoUrl: school.logo_url || null,
      initials: schoolInitials(schoolName),
      portalSlug: school.slug || school.subdomain || null,
      tenantId,
    },
    teacher: {
      id: teacher.id,
      fullName: teacher.full_name,
      staffId: teacher.staff_id,
      photoUrl: teacher.passport_photo_url || null,
      signature: teacher.signature || null,
      employmentDate: teacher.employment_date,
      monthlySalary: Number(teacher.monthly_salary) || 0,
      className: teacher.class_name || '',
      subjects,
    },
    positionTitle,
    department,
    employmentType,
    terms: {
      position: positionTitle,
      department,
      startDate: teacher.employment_date,
      employmentType,
      probationPeriod: config.probationPeriod || '',
      monthlySalary: Number(teacher.monthly_salary) || 0,
      workingHours: config.workingHours || '',
      leaveEntitlement: config.leaveEntitlement || '',
      noticePeriod: config.noticePeriod || '',
    },
    bodyOpening: applySchoolPlaceholder(rawOpening, schoolName),
    bodyClosing: applySchoolPlaceholder(rawClosing, schoolName),
    config,
  };

  return { ready: true, checklist, letter };
}

async function issueTeacherPortalCredentials(
  tenantId: number,
  teacherId: number,
  staffId: string
): Promise<TeacherPortalAccess> {
  const pin = generatePin();
  const passwordHash = await bcrypt.hash(pin, 10);

  const userRes = await query(
    `SELECT id FROM users WHERE tenant_id = $1 AND teacher_id = $2`,
    [tenantId, String(teacherId)]
  );

  if (userRes.rows[0]) {
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      passwordHash,
      userRes.rows[0].id,
    ]);
  } else {
    const teacherRes = await query(
      `SELECT full_name, email FROM teachers WHERE id = $1 AND tenant_id = $2`,
      [teacherId, tenantId]
    );
    const teacherRow = teacherRes.rows[0];
    await query(
      `INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id)
       VALUES ($1, $2, $3, $4, $5, 'teacher', $6)`,
      [
        tenantId,
        staffId,
        teacherRow?.full_name || staffId,
        teacherRow?.email || null,
        passwordHash,
        String(teacherId),
      ]
    );
  }

  const tenantRes = await query(`SELECT slug, subdomain FROM tenants WHERE id = $1`, [tenantId]);
  const slug = tenantRes.rows[0]?.slug || tenantRes.rows[0]?.subdomain || null;

  return {
    username: staffId,
    temporaryPassword: pin,
    portalSlug: slug,
    tenantId,
    mustChangePassword: true,
    instructions:
      'Use the credentials below to log in to the teacher portal. You must change your password after your first login.',
  };
}

export async function saveAppointmentLetter(options: {
  tenantId: number;
  teacherId: number;
  userId: number;
  userRole?: string;
  letterContent: Record<string, unknown>;
  pdfData?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const content = options.letterContent as Record<string, any>;
  const versionNumber = Number(content.versionNumber) || 1;
  const terms = content.terms || {};
  const letterDate = content.letterDate || content.generatedDate || new Date().toISOString().slice(0, 10);

  const staffId = String(content.teacher?.staffId || '').trim();
  if (staffId) {
    content.portalAccess = await issueTeacherPortalCredentials(
      options.tenantId,
      options.teacherId,
      staffId
    );
  }

  const inserted = await query(
    `INSERT INTO teacher_appointment_letters (
       tenant_id, teacher_id, version_number, reference_number, position_title,
       employment_type, monthly_salary, letter_content, pdf_data, generated_by,
       employee_name, role, department, start_date, probation_period, working_hours,
       leave_entitlement, notice_period, body_opening, body_closing, letter_date
     ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      options.tenantId,
      options.teacherId,
      versionNumber,
      content.positionTitle || terms.position || null,
      content.employmentType || terms.employmentType || 'Permanent',
      content.teacher?.monthlySalary ?? terms.monthlySalary ?? null,
      JSON.stringify(content),
      options.pdfData || null,
      options.userId,
      content.teacher?.fullName || null,
      content.positionTitle || terms.position || null,
      content.department || terms.department || null,
      content.teacher?.employmentDate || terms.startDate || null,
      terms.probationPeriod || content.config?.probationPeriod || null,
      terms.workingHours || content.config?.workingHours || null,
      terms.leaveEntitlement || content.config?.leaveEntitlement || null,
      terms.noticePeriod || content.config?.noticePeriod || null,
      content.bodyOpening || null,
      content.bodyClosing || null,
      letterDate,
    ]
  );

  const row = inserted.rows[0];
  const year = new Date().getFullYear();
  const referenceNumber = `APT/${year}/TCH${String(row.id).padStart(4, '0')}`;
  content.referenceNumber = referenceNumber;

  await query(
    `UPDATE teacher_appointment_letters
     SET reference_number = $1, letter_content = $2::jsonb
     WHERE id = $3 AND tenant_id = $4`,
    [referenceNumber, JSON.stringify(content), row.id, options.tenantId]
  );

  await writeAuditLog({
    tenantId: options.tenantId,
    userId: options.userId,
    userRole: options.userRole,
    action: 'APPOINTMENT_LETTER_GENERATED',
    entityType: 'TEACHER',
    entityId: options.teacherId,
    module: 'teachers',
    summary: `Appointment letter v${versionNumber} for ${content.teacher?.fullName || 'teacher'}`,
    details: {
      versionNumber,
      referenceNumber,
      positionTitle: content.positionTitle,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });

  return { ...row, reference_number: referenceNumber, letter_content: content };
}

export async function listAppointmentLetters(tenantId: number, teacherId: number) {
  const res = await query(
    `SELECT id, version_number, reference_number, position_title, employment_type,
            monthly_salary, generated_at, generated_by, letter_date,
            (pdf_data IS NOT NULL AND length(pdf_data) > 0) AS has_pdf
     FROM teacher_appointment_letters
     WHERE tenant_id = $1 AND teacher_id = $2
     ORDER BY version_number DESC`,
    [tenantId, teacherId]
  );
  return res.rows;
}

export async function getAppointmentLetterPdf(tenantId: number, teacherId: number, letterId: number) {
  const res = await query(
    `SELECT id, version_number, reference_number, pdf_data, letter_content
     FROM teacher_appointment_letters
     WHERE tenant_id = $1 AND teacher_id = $2 AND id = $3`,
    [tenantId, teacherId, letterId]
  );
  return res.rows[0] || null;
}
