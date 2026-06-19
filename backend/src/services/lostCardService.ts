import crypto from 'crypto';
import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { getPrimaryAdminEmail, sendAdminEmail } from './emailService.js';
import { getSchoolCardContext } from './idCardService.js';

export type VerificationStatus = 'verified' | 'revoked' | 'inactive';

export type CardHolderInfo = {
  tenantId: number;
  entityType: 'STUDENT' | 'STAFF';
  entityId: number;
  bearerName: string;
  idNumber: string;
  cardTypeLabel: string;
  schoolName: string;
  phone: string;
  website: string;
  logoUrl: string | null;
  photoUrl: string | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
};

async function latestCardRecord(tenantId: number, entityType: 'STUDENT' | 'STAFF', entityId: number) {
  const res = await query(
    `SELECT status, generated_at FROM generated_id_cards
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
     ORDER BY generated_at DESC LIMIT 1`,
    [tenantId, entityType, entityId]
  );
  return res.rows[0] as { status: string; generated_at: string } | undefined;
}

function resolveVerification(
  enrollmentActive: boolean,
  cardRow?: { status: string; generated_at: string }
): Pick<CardHolderInfo, 'verified' | 'verificationStatus' | 'verifiedAt'> {
  if (!enrollmentActive) {
    return { verified: false, verificationStatus: 'inactive', verifiedAt: null };
  }
  if (cardRow?.status === 'REVOKED') {
    return { verified: false, verificationStatus: 'revoked', verifiedAt: cardRow.generated_at || null };
  }
  return {
    verified: true,
    verificationStatus: 'verified',
    verifiedAt: cardRow?.generated_at || null,
  };
}

export type LostCardReportRow = {
  id: string;
  reference_code: string;
  tenant_id: number;
  entity_type: string;
  entity_id: number;
  scanned_id: string;
  bearer_name: string;
  card_type_label: string;
  reported_at: string;
  ip_address: string | null;
  initial_notified_at: string | null;
  found_location: string | null;
  collection_point: string | null;
  reporter_phone: string | null;
  details_submitted_at: string | null;
  detail_skipped: boolean;
  status: string;
};

function referenceFromId(id: string): string {
  const compact = id.replace(/-/g, '').toUpperCase();
  return `LCR-${compact.slice(-4)}`;
}

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
}

export async function resolveCardHolder(entityTypeRaw: string, entityId: number): Promise<CardHolderInfo | null> {
  const entityType = entityTypeRaw.toUpperCase() === 'STAFF' ? 'STAFF' : 'STUDENT';

  if (entityType === 'STUDENT') {
    const res = await query(
      `SELECT s.id, s.tenant_id, s.first_name, s.last_name, s.student_id, s.passport_photo_url,
              COALESCE(s.enrollment_status, 'active') AS enrollment_status
       FROM students s WHERE s.id = $1`,
      [entityId]
    );
    const row = res.rows[0];
    if (!row) return null;
    const tenantId = Number(row.tenant_id);
    const ctx = await getSchoolCardContext(tenantId);
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    const slug = String(ctx?.slug || 'school');
    const cardRow = await latestCardRecord(tenantId, 'STUDENT', Number(row.id));
    const enrollmentActive = String(row.enrollment_status || 'active').toLowerCase() === 'active';
    const verification = resolveVerification(enrollmentActive, cardRow);
    return {
      tenantId,
      entityType: 'STUDENT',
      entityId: Number(row.id),
      bearerName: `${String(row.first_name)} ${String(row.last_name)}`.trim(),
      idNumber: String(row.student_id),
      cardTypeLabel: 'Student Card',
      schoolName,
      phone: String(ctx?.contact_phone || ctx?.phone_number || ctx?.contact || ''),
      website: `www.${slug}.edu.gh`,
      logoUrl: ctx?.logo_url ? String(ctx.logo_url) : null,
      photoUrl: row.passport_photo_url ? String(row.passport_photo_url) : null,
      ...verification,
    };
  }

  let row: Record<string, unknown> | undefined;
  const teacher = await query(`SELECT id, tenant_id, full_name, staff_id, passport_photo_url FROM teachers WHERE id = $1`, [
    entityId,
  ]);
  if (teacher.rows[0]) {
    row = teacher.rows[0];
  } else {
    const other = await query(`SELECT id, tenant_id, full_name, staff_id, passport_photo_url FROM other_staff WHERE id = $1`, [
      entityId,
    ]);
    row = other.rows[0];
  }
  if (!row) return null;

  const tenantId = Number(row.tenant_id);
  const ctx = await getSchoolCardContext(tenantId);
  const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
  const slug = String(ctx?.slug || 'school');
  const cardRow = await latestCardRecord(tenantId, 'STAFF', Number(row.id));
  const verification = resolveVerification(true, cardRow);
  return {
    tenantId,
    entityType: 'STAFF',
    entityId: Number(row.id),
    bearerName: String(row.full_name),
    idNumber: String(row.staff_id),
    cardTypeLabel: 'Staff Card',
    schoolName,
    phone: String(ctx?.contact_phone || ctx?.phone_number || ctx?.contact || ''),
    website: `www.${slug}.edu.gh`,
    logoUrl: ctx?.logo_url ? String(ctx.logo_url) : null,
    photoUrl: row.passport_photo_url ? String(row.passport_photo_url) : null,
    ...verification,
  };
}

async function createAdminNotification(opts: {
  tenantId: number;
  title: string;
  message: string;
  link: string;
  priority: 'HIGH' | 'NORMAL';
  reportId: string;
}) {
  const inserted = await query(
    `INSERT INTO tenant_admin_notifications
       (tenant_id, notification_type, title, message, link, priority, report_id)
     VALUES ($1, 'lost-card', $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [opts.tenantId, opts.title, opts.message, opts.link, opts.priority, opts.reportId]
  );
  try {
    const io = getIO();
    io.to(`tenant:${opts.tenantId}`).emit('lost-card-report', {
      reportId: opts.reportId,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      notificationId: inserted.rows[0]?.id,
    });
    io.to(`tenant:${opts.tenantId}`).emit('tenant-data-changed', {
      tenantId: opts.tenantId,
      entity: 'lost-card',
      action: 'created',
      at: Date.now(),
    });
  } catch {
    /* socket optional */
  }
  return inserted.rows[0];
}

export async function createInitialLostCardReport(
  holder: CardHolderInfo,
  ipAddress: string | null
): Promise<{ reportId: string; referenceCode: string }> {
  const id = crypto.randomUUID();
  const referenceCode = referenceFromId(id);

  await query(
    `INSERT INTO lost_card_reports (
       id, reference_code, tenant_id, entity_type, entity_id, scanned_id, bearer_name,
       card_type_label, ip_address, initial_notified_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
    [
      id,
      referenceCode,
      holder.tenantId,
      holder.entityType,
      holder.entityId,
      holder.idNumber,
      holder.bearerName,
      holder.cardTypeLabel,
      ipAddress,
    ]
  );

  const adminLink = `lost-cards/${id}`;
  const viewUrl = `${appBaseUrl()}/${adminLink}`;

  await createAdminNotification({
    tenantId: holder.tenantId,
    title: '🚨 Lost Card Reported',
    message: `Someone has just reported a lost card for ${holder.bearerName} (${holder.idNumber}). More details may follow shortly.`,
    link: adminLink,
    priority: 'HIGH',
    reportId: id,
  });

  const adminEmail = await getPrimaryAdminEmail(holder.tenantId);
  const reportedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  await sendAdminEmail({
    to: adminEmail || '',
    subject: `🚨 Lost Card Alert — ${holder.bearerName} (${holder.idNumber})`,
    text: [
      `A lost card has just been reported for a ${holder.entityType === 'STAFF' ? 'staff member' : 'student'} at ${holder.schoolName}.`,
      '',
      'CARD DETAILS',
      `Name: ${holder.bearerName}`,
      `ID: ${holder.idNumber}`,
      `Type: ${holder.cardTypeLabel}`,
      '',
      '⏳ The person who found the card is currently providing more details. You will receive a follow-up notification with location information shortly.',
      '',
      `You can view this report here: ${viewUrl}`,
      '',
      `Reference: #${referenceCode}`,
      `Reported at: ${reportedAt}`,
    ].join('\n'),
  });

  return { reportId: id, referenceCode };
}

export async function submitLostCardDetails(
  reportId: string,
  details: {
    foundLocation?: string | null;
    collectionPoint?: string | null;
    reporterPhone?: string | null;
    skipped?: boolean;
  }
): Promise<{ success: boolean; referenceCode: string; schoolName: string; phone: string; website: string } | null> {
  const res = await query(`SELECT * FROM lost_card_reports WHERE id = $1`, [reportId]);
  const report = res.rows[0] as LostCardReportRow | undefined;
  if (!report) return null;

  const skipped = !!details.skipped;
  const foundLocation = skipped ? null : (details.foundLocation?.trim() || null);
  const collectionPoint = skipped ? null : (details.collectionPoint?.trim() || null);
  const reporterPhone = skipped ? null : (details.reporterPhone?.trim() || null);

  await query(
    `UPDATE lost_card_reports
     SET found_location = $1, collection_point = $2, reporter_phone = $3,
         details_submitted_at = CURRENT_TIMESTAMP, detail_skipped = $4
     WHERE id = $5`,
    [foundLocation, collectionPoint, reporterPhone, skipped, reportId]
  );

  const holder = await resolveCardHolder(report.entity_type, report.entity_id);
  const ctx = await getSchoolCardContext(report.tenant_id);
  const schoolName = holder?.schoolName || String(ctx?.school_name || 'School');
  const phone = holder?.phone || String(ctx?.contact_phone || ctx?.phone_number || '');
  const website = holder?.website || '';

  if (!skipped) {
    const adminLink = `lost-cards/${reportId}`;
    await createAdminNotification({
      tenantId: report.tenant_id,
      title: '📍 Lost Card Details Received',
      message: `${report.bearer_name}'s card — location details added to report`,
      link: adminLink,
      priority: 'NORMAL',
      reportId,
    });

    const adminEmail = await getPrimaryAdminEmail(report.tenant_id);
    const viewUrl = `${appBaseUrl()}/${adminLink}`;
    await sendAdminEmail({
      to: adminEmail || '',
      subject: `📍 Lost Card Details — ${report.bearer_name} (${report.scanned_id})`,
      text: [
        'The person who reported the lost card has provided location details.',
        '',
        'WHERE THE CARD WAS FOUND:',
        `"${foundLocation || 'Not provided'}"`,
        '',
        'WHERE TO COLLECT / REACH REPORTER:',
        `"${collectionPoint || 'Not provided'}"`,
        '',
        'REPORTER PHONE:',
        reporterPhone || 'Not provided',
        '',
        `View and manage this report: ${viewUrl}`,
      ].join('\n'),
    });
  }

  return {
    success: true,
    referenceCode: report.reference_code,
    schoolName,
    phone,
    website,
  };
}

export async function getLostCardReport(reportId: string, tenantId?: number) {
  const params: Array<string | number> = [reportId];
  let tenantFilter = '';
  if (tenantId) {
    tenantFilter = ' AND tenant_id = $2';
    params.push(tenantId);
  }
  const res = await query(`SELECT * FROM lost_card_reports WHERE id = $1${tenantFilter}`, params);
  return (res.rows[0] as LostCardReportRow) || null;
}

export async function listLostCardReports(tenantId: number) {
  const res = await query(
    `SELECT id, reference_code, bearer_name, scanned_id, entity_type, status, reported_at,
            details_submitted_at, detail_skipped
     FROM lost_card_reports
     WHERE tenant_id = $1
     ORDER BY reported_at DESC
     LIMIT 100`,
    [tenantId]
  );
  return res.rows;
}

export async function getUnreadLostCardNotifications(tenantId: number) {
  const res = await query(
    `SELECT id, title, message, link, priority, report_id, created_at
     FROM tenant_admin_notifications
     WHERE tenant_id = $1 AND notification_type = 'lost-card' AND read_at IS NULL
     ORDER BY CASE priority WHEN 'HIGH' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 20`,
    [tenantId]
  );
  return res.rows;
}

export async function markLostCardNotificationRead(notificationId: number, tenantId: number) {
  await query(
    `UPDATE tenant_admin_notifications SET read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [notificationId, tenantId]
  );
}

export function buildReportTimeline(report: LostCardReportRow) {
  const events: Array<{ icon: string; at: string; title: string; detail?: string }> = [];
  events.push({
    icon: '🔴',
    at: report.reported_at,
    title: 'Lost card reported — school notified immediately',
  });
  if (report.details_submitted_at) {
    if (report.detail_skipped) {
      events.push({
        icon: '⏭️',
        at: report.details_submitted_at,
        title: 'Reporter skipped providing details',
      });
    } else {
      const parts = [
        report.found_location ? `Found at: "${report.found_location}"` : null,
        report.collection_point ? `Collection: "${report.collection_point}"` : null,
        report.reporter_phone ? `Phone: ${report.reporter_phone}` : null,
      ].filter(Boolean);
      events.push({
        icon: '📍',
        at: report.details_submitted_at,
        title: 'Reporter submitted location details',
        detail: parts.join('\n'),
      });
    }
  }
  return events;
}
