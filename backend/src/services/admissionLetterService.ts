import { query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';
import { resolveSchoolDisplayName } from './schoolBrandingService.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export type AdmissionLetterConfig = {
  bodyOpening?: string;
  bodyClosing?: string;
  clauses?: string[];
  signatoryName?: string;
  signatoryTitle?: string;
  signatureImage?: string | null;
  stampImage?: string | null;
};

export type AdmissionLetterContent = {
  referenceNumber: string | null;
  versionNumber: number;
  student: {
    id: number;
    fullName: string;
    studentId: string;
    admissionNumber: string;
    className: string;
    admissionDate: string;
    photoUrl: string | null;
  };
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string | null;
  };
  bodyOpening: string;
  bodyClosing: string;
  clauses: string[];
  config: {
    signatoryName?: string;
    signatoryTitle?: string;
    signatureImage?: string | null;
    stampImage?: string | null;
  };
};

export async function getAdmissionLetterConfig(tenantId: number): Promise<AdmissionLetterConfig> {
  const res = await query(
    `SELECT admission_letter_config FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const raw = res.rows[0]?.admission_letter_config;
  if (!raw || typeof raw !== 'object') return {};
  return raw as AdmissionLetterConfig;
}

export async function saveAdmissionLetterConfig(tenantId: number, config: AdmissionLetterConfig) {
  await query(
    `UPDATE school_settings SET admission_letter_config = $1::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2`,
    [JSON.stringify(config), tenantId]
  );
}

export async function buildAdmissionLetterContent(
  tenantId: number,
  studentId: number
): Promise<AdmissionLetterContent | null> {
  const studentRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
            s.date_of_admission, s.passport_photo_url, c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;
  const student = studentRes.rows[0];

  const settingsRes = await query(
    `SELECT ss.school_name,
            COALESCE(NULLIF(ss.physical_address, ''), ss.address, ss.postal_address, '') AS address,
            COALESCE(NULLIF(ss.contact_phone, ''), ss.phone_number, ss.contact, '') AS phone,
            COALESCE(ss.email, '') AS email,
            COALESCE(NULLIF(ss.logo_url, ''), t.logo_url) AS logo_url,
            ss.appointment_letter_config,
            ss.admission_letter_config
     FROM school_settings ss
     LEFT JOIN tenants t ON t.id = ss.tenant_id
     WHERE ss.tenant_id = $1`,
    [tenantId]
  );
  const settings = settingsRes.rows[0] || {};
  const apptConfig = settings.appointment_letter_config || {};
  const admConfig: AdmissionLetterConfig = settings.admission_letter_config || {};
  const schoolName = await resolveSchoolDisplayName(tenantId);

  const admissionDate = student.date_of_admission
    ? formatDate(student.date_of_admission)
    : formatDate(new Date().toISOString());

  return {
    referenceNumber: null,
    versionNumber: 1,
    student: {
      id: student.id,
      fullName: `${student.first_name} ${student.last_name}`.trim(),
      studentId: String(student.student_id || ''),
      admissionNumber: String(student.admission_number || student.student_id || ''),
      className: String(student.class_name || ''),
      admissionDate,
      photoUrl: student.passport_photo_url ? String(student.passport_photo_url) : null,
    },
    school: {
      name: schoolName,
      address: String(settings.address || ''),
      phone: String(settings.phone || ''),
      email: String(settings.email || ''),
      logoUrl: settings.logo_url ? String(settings.logo_url) : null,
    },
    bodyOpening: admConfig.bodyOpening || `We are delighted to inform you that after a careful review of your application, you have been granted admission into ${schoolName} for the academic year. This letter serves as an official notification of your admission and outlines the terms, conditions, and expectations that govern your enrolment.`,

    bodyClosing: admConfig.bodyClosing || `We warmly welcome you to ${schoolName} and look forward to a productive and rewarding academic journey together. Please retain this letter for your records and present it when required for any official purpose within the school.`,

    clauses: admConfig.clauses && admConfig.clauses.length > 0 ? admConfig.clauses : [
      'The student must attend all classes punctually and maintain at least 90% attendance each term to be eligible for end-of-term examinations and continuous assessment.',
      'The school uniform must be worn at all times while on school premises and during school-sanctioned activities. Students must present themselves neatly and in accordance with the school\u2019s dress code.',
      'All academic fees must be paid in full by the end of the first week of each term. Failure to comply may result in the student being barred from attending classes and writing examinations.',
      'The student is expected to uphold the highest standards of discipline, respect, and moral conduct. Bullying, insubordination, vandalism, and any form of academic dishonesty will attract severe disciplinary action, including possible suspension or expulsion.',
      'Parents or guardians must notify the school administration in writing at least two weeks in advance of any planned absence. Medical certificates must be provided for illness-related absences exceeding three consecutive days.',
      'The school reserves the right to review and amend these terms as necessary. Parents and guardians will be notified of any changes at least one term before they take effect.',
    ],

    config: {
      signatoryName: apptConfig.signatoryName ? String(apptConfig.signatoryName) : undefined,
      signatoryTitle: apptConfig.signatoryTitle ? String(apptConfig.signatoryTitle) : undefined,
      signatureImage: apptConfig.signatureImage ? String(apptConfig.signatureImage) : null,
      stampImage: apptConfig.stampImage ? String(apptConfig.stampImage) : null,
    },
  };
}

export async function saveAdmissionLetter(options: {
  tenantId: number;
  studentId: number;
  userId: number;
  userRole?: string;
  letterContent: AdmissionLetterContent;
  pdfData?: string | null;
}) {
  const content = options.letterContent;
  const versionNumber = Number(content.versionNumber) || 1;

  const inserted = await query(
    `INSERT INTO student_admission_letters (
       tenant_id, student_id, version_number, reference_number, letter_content, pdf_data, generated_by
     ) VALUES ($1, $2, $3, NULL, $4::jsonb, $5, $6)
     RETURNING *`,
    [
      options.tenantId,
      options.studentId,
      versionNumber,
      JSON.stringify(content),
      options.pdfData || null,
      options.userId,
    ]
  );

  const row = inserted.rows[0];
  const year = new Date().getFullYear();
  const referenceNumber = `ADM/${year}/STU${String(row.id).padStart(4, '0')}`;
  content.referenceNumber = referenceNumber;

  await query(
    `UPDATE student_admission_letters
     SET reference_number = $1, letter_content = $2::jsonb
     WHERE id = $3 AND tenant_id = $4`,
    [referenceNumber, JSON.stringify(content), row.id, options.tenantId]
  );

  await writeAuditLog({
    tenantId: options.tenantId,
    userId: options.userId,
    userRole: options.userRole,
    action: 'ADMISSION_LETTER_GENERATED',
    entityType: 'STUDENT',
    entityId: options.studentId,
    module: 'students',
    summary: `Admission letter v${versionNumber} for ${content.student.fullName || 'student'}`,
    details: { versionNumber, referenceNumber },
  });

  return {
    id: row.id,
    version_number: versionNumber,
    reference_number: referenceNumber,
    letter_content: content,
  };
}

export async function getAdmissionLetterPdf(
  tenantId: number,
  studentId: number,
  letterId: number
): Promise<Record<string, unknown> | null> {
  const res = await query(
    `SELECT id, version_number, reference_number, letter_content, pdf_data
     FROM student_admission_letters
     WHERE id = $1 AND student_id = $2 AND tenant_id = $3`,
    [letterId, studentId, tenantId]
  );
  return res.rows[0] || null;
}

/** Refresh live media (logo, photo, class) on a saved letter snapshot for download/preview. */
export async function enrichAdmissionLetterContent(
  tenantId: number,
  studentId: number,
  content: AdmissionLetterContent
): Promise<AdmissionLetterContent> {
  const fresh = await buildAdmissionLetterContent(tenantId, studentId);
  if (!fresh) return content;
  return {
    ...content,
    school: {
      ...content.school,
      logoUrl: fresh.school.logoUrl || content.school.logoUrl,
      name: content.school.name || fresh.school.name,
      address: content.school.address || fresh.school.address,
      phone: content.school.phone || fresh.school.phone,
      email: content.school.email || fresh.school.email,
    },
    student: {
      ...content.student,
      photoUrl: fresh.student.photoUrl || content.student.photoUrl,
      className: fresh.student.className || content.student.className,
    },
  };
}

export async function listAdmissionLetters(
  tenantId: number,
  studentId: number
): Promise<Array<{ id: number; version_number: number; reference_number: string | null; created_at: string }>> {
  const res = await query(
    `SELECT id, version_number, reference_number, created_at
     FROM student_admission_letters
     WHERE student_id = $1 AND tenant_id = $2
     ORDER BY version_number DESC`,
    [studentId, tenantId]
  );
  return res.rows;
}
