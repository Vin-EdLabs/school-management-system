import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { sendPushToStaffUser } from './webPushService.js';
import { notifyStaffUser } from './staffNotificationService.js';
import { TEACHER_VISIBLE_WHERE } from '../constants/staffQueries.js';

export type ComplaintType = 'student' | 'teacher';
export type ComplaintSeverity = 'low' | 'medium' | 'high';
export type ComplaintStatus = 'pending' | 'under_review' | 'resolved';

export type CreateComplaintInput = {
  complaint_type: ComplaintType;
  subject_student_id?: number | null;
  subject_teacher_id?: number | null;
  title: string;
  description: string;
  severity: ComplaintSeverity;
  is_anonymous?: boolean;
};

export type ListComplaintsFilters = {
  complaint_type?: ComplaintType;
  status?: ComplaintStatus | 'active';
  severity?: ComplaintSeverity;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
  filed_by?: number;
};

type HttpError = Error & { status?: number };

function httpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

async function getTeacherScopedClassIds(tenantId: number, teacherId: number): Promise<Set<number>> {
  const ids = new Set<number>();
  if (!Number.isFinite(teacherId)) return ids;

  const direct = await query(
    `SELECT id FROM classes WHERE tenant_id = $1 AND assigned_teacher_id = $2::int`,
    [tenantId, teacherId]
  );
  for (const row of direct.rows as { id: number }[]) ids.add(Number(row.id));

  const junction = await query(
    `SELECT class_id FROM class_teachers WHERE tenant_id = $1 AND teacher_id = $2::int`,
    [tenantId, teacherId]
  );
  for (const row of junction.rows as { class_id: number }[]) ids.add(Number(row.class_id));

  return ids;
}

function displayName(row: { full_name?: string | null; username?: string | null }): string {
  return String(row.full_name || row.username || 'Unknown').trim() || 'Unknown';
}

async function createAdminComplaintNotification(opts: {
  tenantId: number;
  title: string;
  message: string;
  complaintId: number;
  priority: 'HIGH' | 'NORMAL';
}) {
  const inserted = await query(
    `INSERT INTO tenant_admin_notifications
       (tenant_id, notification_type, title, message, link, priority, report_id)
     VALUES ($1, 'complaint', $2, $3, $4, $5, NULL)
     RETURNING id, created_at`,
    [opts.tenantId, opts.title, opts.message, `complaints/${opts.complaintId}`, opts.priority]
  );

  try {
    const io = getIO();
    io.to(`tenant:${opts.tenantId}`).emit('complaint-filed', {
      complaintId: opts.complaintId,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      notificationId: inserted.rows[0]?.id,
    });
    io.to(`tenant:${opts.tenantId}`).emit('tenant-data-changed', {
      tenantId: opts.tenantId,
      entity: 'complaint',
      action: 'created',
      complaintId: opts.complaintId,
      at: Date.now(),
    });
  } catch {
    /* socket optional */
  }
}

async function notifyFilingTeacher(opts: {
  tenantId: number;
  userId: number;
  title: string;
  body: string;
  complaintId: number;
  status: ComplaintStatus;
}) {
  try {
    const io = getIO();
    io.to(`tenant:${opts.tenantId}`).emit('tenant-data-changed', {
      tenantId: opts.tenantId,
      entity: 'complaint-update',
      userId: opts.userId,
      complaintId: opts.complaintId,
      status: opts.status,
      title: opts.title,
      body: opts.body,
      at: Date.now(),
    });
  } catch {
    /* socket optional */
  }

  await notifyStaffUser(opts.userId, opts.tenantId, {
    kind: 'complaint',
    title: opts.title,
    message: opts.body,
    url: '/?module=my-complaints',
    referenceKey: `complaint:${opts.complaintId}:${opts.userId}`,
    push: {
      title: opts.title,
      body: opts.body,
      url: '/?module=my-complaints',
    },
  }).catch(() => undefined);
}

function mapFiler(row: Record<string, unknown>, forAdmin: boolean) {
  if (row.is_anonymous && forAdmin) {
    return { id: null as number | null, name: 'Anonymous', role: null as string | null };
  }
  if (row.is_anonymous && !forAdmin) {
    // Filer viewing own complaint still knows themselves; keep identity for "my" list
    return {
      id: Number(row.filed_by),
      name: displayName({
        full_name: row.filer_full_name as string | null,
        username: row.filer_username as string | null,
      }),
      role: (row.filer_role as string) || null,
    };
  }
  return {
    id: Number(row.filed_by),
    name: displayName({
      full_name: row.filer_full_name as string | null,
      username: row.filer_username as string | null,
    }),
    role: (row.filer_role as string) || null,
  };
}

function mapSubject(row: Record<string, unknown>) {
  if (row.complaint_type === 'student') {
    return {
      id: row.subject_student_id != null ? Number(row.subject_student_id) : null,
      name: [row.student_first_name, row.student_last_name].filter(Boolean).join(' ').trim() || 'Student',
      kind: 'student' as const,
      class_name: (row.student_class_name as string) || null,
    };
  }
  return {
    id: row.subject_teacher_id != null ? Number(row.subject_teacher_id) : null,
    name: displayName({
      full_name: row.subject_teacher_full_name as string | null,
      username: row.subject_teacher_username as string | null,
    }),
    kind: 'teacher' as const,
    class_name: null as string | null,
  };
}

function mapResolvedBy(row: Record<string, unknown>) {
  if (!row.resolved_by) return null;
  return {
    id: Number(row.resolved_by),
    name: displayName({
      full_name: row.resolver_full_name as string | null,
      username: row.resolver_username as string | null,
    }),
  };
}

const COMPLAINT_SELECT = `
  c.*,
  fu.full_name AS filer_full_name,
  fu.username AS filer_username,
  fu.role AS filer_role,
  su.full_name AS subject_teacher_full_name,
  su.username AS subject_teacher_username,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  cl.class_name AS student_class_name,
  ru.full_name AS resolver_full_name,
  ru.username AS resolver_username
`;

const COMPLAINT_JOINS = `
  FROM complaints c
  JOIN users fu ON fu.id = c.filed_by
  LEFT JOIN users su ON su.id = c.subject_teacher_id
  LEFT JOIN students s ON s.id = c.subject_student_id AND s.tenant_id = c.tenant_id
  LEFT JOIN classes cl ON cl.id = s.class_assigned_id AND cl.tenant_id = c.tenant_id
  LEFT JOIN users ru ON ru.id = c.resolved_by
`;

async function loadHistory(complaintId: number) {
  const result = await query(
    `SELECT h.id, h.complaint_id, h.changed_by, h.old_status, h.new_status, h.note,
            h.created_at::text AS created_at,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, 'System') AS changed_by_name
     FROM complaint_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.complaint_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [complaintId]
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    complaint_id: Number(r.complaint_id),
    changed_by: Number(r.changed_by),
    changed_by_name: r.changed_by_name as string,
    old_status: r.old_status as ComplaintStatus | null,
    new_status: r.new_status as ComplaintStatus,
    note: (r.note as string) || null,
    created_at: r.created_at as string,
  }));
}

function serializeComplaint(row: Record<string, unknown>, opts: { forAdmin: boolean; includeHistory?: boolean; history?: Awaited<ReturnType<typeof loadHistory>> }) {
  const filedBy = mapFiler(row, opts.forAdmin);
  // When forAdmin and anonymous, never leak id
  if (opts.forAdmin && row.is_anonymous) {
    filedBy.id = null;
    filedBy.name = 'Anonymous';
    filedBy.role = null;
  }

  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    complaint_type: row.complaint_type as ComplaintType,
    title: row.title as string,
    description: row.description as string,
    severity: row.severity as ComplaintSeverity,
    is_anonymous: !!row.is_anonymous,
    status: row.status as ComplaintStatus,
    resolution_note: (row.resolution_note as string) || null,
    resolved_at: (row.resolved_at as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    filed_by: filedBy,
    subject: mapSubject(row),
    resolved_by: mapResolvedBy(row),
    status_history: opts.includeHistory ? opts.history || [] : undefined,
  };
}

export async function createComplaint(tenantId: number, filedBy: number, input: CreateComplaintInput) {
  const type = input.complaint_type;
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const severity = (input.severity || 'medium') as ComplaintSeverity;

  if (!['student', 'teacher'].includes(type)) {
    throw httpError(400, 'complaint_type must be student or teacher');
  }
  if (!title || title.length > 255) {
    throw httpError(400, 'title is required (max 255 characters)');
  }
  if (description.length < 20) {
    throw httpError(400, 'description must be at least 20 characters');
  }
  if (!['low', 'medium', 'high'].includes(severity)) {
    throw httpError(400, 'severity must be low, medium, or high');
  }

  let subjectStudentId: number | null = null;
  let subjectTeacherId: number | null = null;
  let isAnonymous = false;

  if (type === 'student') {
    subjectStudentId = Number(input.subject_student_id);
    if (!Number.isFinite(subjectStudentId)) {
      throw httpError(400, 'subject_student_id is required for student complaints');
    }
    const filer = await query(
      `SELECT teacher_id FROM users WHERE id = $1 AND tenant_id = $2`,
      [filedBy, tenantId]
    );
    const teacherId = Number(filer.rows[0]?.teacher_id);
    if (!Number.isFinite(teacherId)) {
      throw httpError(403, 'Only teachers assigned to classes can file student complaints');
    }
    const classIds = await getTeacherScopedClassIds(tenantId, teacherId);
    if (classIds.size === 0) {
      throw httpError(400, 'You are not assigned to any class');
    }
    const student = await query(
      `SELECT id, class_assigned_id FROM students
       WHERE id = $1 AND tenant_id = $2 AND COALESCE(enrollment_status, 'active') = 'active'`,
      [subjectStudentId, tenantId]
    );
    if (!student.rows[0]) throw httpError(400, 'Student not found in this school');
    const studentClassId = Number(student.rows[0].class_assigned_id);
    if (!Number.isFinite(studentClassId) || !classIds.has(studentClassId)) {
      throw httpError(400, 'You can only file complaints about students in your assigned classes');
    }
  } else {
    subjectTeacherId = Number(input.subject_teacher_id);
    if (!Number.isFinite(subjectTeacherId)) {
      throw httpError(400, 'subject_teacher_id is required for teacher complaints');
    }
    if (subjectTeacherId === filedBy) {
      throw httpError(400, 'You cannot file a complaint against yourself');
    }
    const teacherUser = await query(
      `SELECT u.id
       FROM users u
       WHERE u.id = $1 AND u.tenant_id = $2
         AND u.role IN ('teacher', 'staff', 'headmaster')
         AND u.teacher_id IS NOT NULL`,
      [subjectTeacherId, tenantId]
    );
    if (!teacherUser.rows[0]) throw httpError(400, 'Teacher not found in this school');
    isAnonymous = !!input.is_anonymous;
  }

  const inserted = await query(
    `INSERT INTO complaints (
       tenant_id, complaint_type, filed_by, subject_student_id, subject_teacher_id,
       title, description, severity, is_anonymous, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
     RETURNING id`,
    [
      tenantId,
      type,
      filedBy,
      subjectStudentId,
      subjectTeacherId,
      title,
      description,
      severity,
      isAnonymous,
    ]
  );

  const complaintId = Number(inserted.rows[0].id);

  await query(
    `INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status, note)
     VALUES ($1, $2, NULL, 'pending', $3)`,
    [complaintId, filedBy, 'Complaint filed']
  );

  await createAdminComplaintNotification({
    tenantId,
    title: severity === 'high' ? 'High severity complaint filed' : 'New complaint filed',
    message: `${isAnonymous ? 'An anonymous teacher' : 'A teacher'} filed a ${type} complaint: "${title}"`,
    complaintId,
    priority: severity === 'high' ? 'HIGH' : 'NORMAL',
  });

  return getComplaintById(tenantId, complaintId, { forAdmin: false, requesterId: filedBy });
}

export async function listComplaints(tenantId: number, filters: ListComplaintsFilters, forAdmin: boolean) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions = ['c.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (filters.filed_by != null) {
    conditions.push(`c.filed_by = $${idx++}`);
    params.push(filters.filed_by);
  }
  if (filters.complaint_type) {
    conditions.push(`c.complaint_type = $${idx++}`);
    params.push(filters.complaint_type);
  }
  if (filters.status === 'active') {
    conditions.push(`c.status IN ('pending', 'under_review')`);
  } else if (filters.status) {
    conditions.push(`c.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.severity) {
    conditions.push(`c.severity = $${idx++}`);
    params.push(filters.severity);
  }
  if (filters.date_from) {
    conditions.push(`c.created_at::date >= $${idx++}::date`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push(`c.created_at::date <= $${idx++}::date`);
    params.push(filters.date_to);
  }
  if (filters.search?.trim()) {
    conditions.push(
      `(c.title ILIKE $${idx} OR c.description ILIKE $${idx} OR s.first_name ILIKE $${idx} OR s.last_name ILIKE $${idx} OR su.full_name ILIKE $${idx} OR su.username ILIKE $${idx})`
    );
    params.push(`%${filters.search.trim()}%`);
    idx += 1;
  }

  const where = conditions.join(' AND ');

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     ${COMPLAINT_JOINS}
     WHERE ${where}`,
    params
  );

  const listRes = await query(
    `SELECT ${COMPLAINT_SELECT}
     ${COMPLAINT_JOINS}
     WHERE ${where}
     ORDER BY
       CASE c.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       c.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const items = [];
  for (const row of listRes.rows) {
    const history = await loadHistory(Number(row.id));
    items.push(serializeComplaint(row, { forAdmin, includeHistory: true, history }));
  }

  const summaryRes = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       COUNT(*) FILTER (WHERE severity = 'high' AND status <> 'resolved')::int AS high_severity
     FROM complaints
     WHERE tenant_id = $1
       ${filters.filed_by != null ? 'AND filed_by = $2' : ''}`,
    filters.filed_by != null ? [tenantId, filters.filed_by] : [tenantId]
  );

  return {
    items,
    total: countRes.rows[0]?.total || 0,
    page,
    limit,
    summary: summaryRes.rows[0] || {
      total: 0,
      pending: 0,
      under_review: 0,
      resolved: 0,
      high_severity: 0,
    },
  };
}

export async function getComplaintById(
  tenantId: number,
  complaintId: number,
  opts: { forAdmin: boolean; requesterId: number }
) {
  const result = await query(
    `SELECT ${COMPLAINT_SELECT}
     ${COMPLAINT_JOINS}
     WHERE c.tenant_id = $1 AND c.id = $2`,
    [tenantId, complaintId]
  );
  const row = result.rows[0];
  if (!row) throw httpError(404, 'Complaint not found');

  if (!opts.forAdmin) {
    if (Number(row.filed_by) !== opts.requesterId) {
      // Teachers cannot look up complaints filed against them
      throw httpError(404, 'Complaint not found');
    }
  }

  const history = await loadHistory(complaintId);
  return serializeComplaint(row, { forAdmin: opts.forAdmin, includeHistory: true, history });
}

const STATUS_FLOW: Record<ComplaintStatus, ComplaintStatus[]> = {
  pending: ['under_review'],
  under_review: ['resolved'],
  resolved: [],
};

export async function updateComplaintStatus(
  tenantId: number,
  complaintId: number,
  actorId: number,
  body: { status: 'under_review' | 'resolved'; note?: string }
) {
  const next = body.status;
  if (next !== 'under_review' && next !== 'resolved') {
    throw httpError(400, 'status must be under_review or resolved');
  }

  const existing = await query(
    `SELECT * FROM complaints WHERE tenant_id = $1 AND id = $2`,
    [tenantId, complaintId]
  );
  const row = existing.rows[0];
  if (!row) throw httpError(404, 'Complaint not found');

  const current = row.status as ComplaintStatus;
  if (!STATUS_FLOW[current].includes(next)) {
    throw httpError(400, `Status can only move forward from ${current}`);
  }

  const note = body.note != null ? String(body.note).trim() : '';
  if (next === 'resolved' && note.length < 20) {
    throw httpError(400, 'resolution note is required (min 20 characters)');
  }

  if (next === 'resolved') {
    await query(
      `UPDATE complaints
       SET status = 'resolved',
           resolution_note = $1,
           resolved_by = $2,
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3 AND id = $4`,
      [note, actorId, tenantId, complaintId]
    );
  } else {
    await query(
      `UPDATE complaints
       SET status = 'under_review',
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, complaintId]
    );
  }

  await query(
    `INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [complaintId, actorId, current, next, note || null]
  );

  const statusLabel = next === 'resolved' ? 'resolved' : 'under review';
  const bodyText =
    next === 'resolved'
      ? `Your complaint "${row.title}" has been marked as resolved. ${note.slice(0, 120)}${note.length > 120 ? '…' : ''}`
      : `Your complaint "${row.title}" has been marked as ${statusLabel}.`;

  await notifyFilingTeacher({
    tenantId,
    userId: Number(row.filed_by),
    title: 'Complaint update',
    body: bodyText,
    complaintId,
    status: next,
  });

  return getComplaintById(tenantId, complaintId, { forAdmin: true, requesterId: actorId });
}

export async function listTeacherSubjects(tenantId: number, excludeUserId: number) {
  const result = await query(
    `SELECT u.id,
            COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(t.full_name), ''), u.username) AS name,
            u.role,
            t.staff_id
     FROM users u
     JOIN teachers t ON t.tenant_id = u.tenant_id AND u.teacher_id::text = t.id::text
     WHERE u.tenant_id = $1
       AND u.id <> $2
       AND u.role IN ('teacher', 'staff', 'headmaster')
       AND ${TEACHER_VISIBLE_WHERE}
     ORDER BY name ASC`,
    [tenantId, excludeUserId]
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    name: r.name as string,
    role: r.role as string,
    staff_id: (r.staff_id as string) || null,
  }));
}

export async function listUnreadComplaintNotifications(tenantId: number) {
  const result = await query(
    `SELECT id, title, message, priority, link, created_at::text AS created_at
     FROM tenant_admin_notifications
     WHERE tenant_id = $1 AND notification_type = 'complaint' AND read_at IS NULL
     ORDER BY created_at DESC
     LIMIT 50`,
    [tenantId]
  );
  return result.rows;
}

export async function markComplaintNotificationRead(tenantId: number, notificationId: number) {
  await query(
    `UPDATE tenant_admin_notifications
     SET read_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND id = $2 AND notification_type = 'complaint'`,
    [tenantId, notificationId]
  );
  return { ok: true };
}
