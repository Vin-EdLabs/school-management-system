import { query } from '../db/connection.js';
import { notifyTenantStaffByRoles } from './staffNotificationService.js';

/** Log outbound WhatsApp intent (integrate provider when available). */
export async function logBoardingWhatsAppMessage(input: {
  tenantId: number;
  phone: string | null | undefined;
  message: string;
  context: string;
  referenceKey?: string;
}): Promise<void> {
  const phone = String(input.phone || '').trim();
  const message = String(input.message || '').trim();
  if (!message) return;

  console.info(`[boarding-whatsapp][${input.context}] to=${phone || 'unknown'}: ${message}`);

  try {
    await query(
      `INSERT INTO boarding_exeat_overdue_notices (tenant_id, exeat_id, channel, notice_date)
       SELECT $1, 0, $2, CURRENT_DATE
       WHERE NOT EXISTS (
         SELECT 1 FROM boarding_exeat_overdue_notices
         WHERE tenant_id = $1 AND channel = $2 AND notice_date = CURRENT_DATE
           AND exeat_id = 0
       )`,
      [input.tenantId, `wa:${input.context}:${input.referenceKey || 'general'}`.slice(0, 20)]
    );
  } catch {
    /* dedup table may not accept exeat_id=0 — log only */
  }
}

export async function notifyOverdueExeatWhatsApp(input: {
  tenantId: number;
  studentId: number;
  studentName: string;
  returnDate: string;
  exeatId: number;
}): Promise<void> {
  const adminMsg = `⚠️ OVERDUE RETURN: ${input.studentName} was due back on ${input.returnDate} and has not yet returned. Please follow up immediately.`;

  await notifyTenantStaffByRoles(input.tenantId, ['administrator', 'house-master', 'matron'], {
    kind: 'general',
    title: 'Overdue exeat return',
    message: adminMsg,
    url: '/boarding/exeats',
    referenceKeyPrefix: `boarding-overdue-exeat:${input.exeatId}`,
  });

  const studentRes = await query(
    `SELECT guardian_contact, guardian_name FROM students WHERE id = $1 AND tenant_id = $2`,
    [input.studentId, input.tenantId]
  );
  const guardianPhone = studentRes.rows[0]?.guardian_contact;
  const parentMsg = `This is a reminder that ${input.studentName} was due to return to school on ${input.returnDate}. Please ensure their safe return.`;

  await logBoardingWhatsAppMessage({
    tenantId: input.tenantId,
    phone: guardianPhone,
    message: parentMsg,
    context: 'overdue-exeat-parent',
    referenceKey: `exeat-${input.exeatId}`,
  });
}

export async function notifyHighSeverityComplaintWhatsApp(input: {
  tenantId: number;
  studentId: number;
  studentName: string;
  complaintId: number;
  title: string;
}): Promise<void> {
  const studentRes = await query(
    `SELECT guardian_contact FROM students WHERE id = $1 AND tenant_id = $2`,
    [input.studentId, input.tenantId]
  );
  const phone = studentRes.rows[0]?.guardian_contact;
  const message = `ScholarNerve: A behavioral concern regarding ${input.studentName} was logged (${input.title}). Please contact the school for details.`;

  await logBoardingWhatsAppMessage({
    tenantId: input.tenantId,
    phone,
    message,
    context: 'complaint-high',
    referenceKey: `complaint-${input.complaintId}`,
  });
}
