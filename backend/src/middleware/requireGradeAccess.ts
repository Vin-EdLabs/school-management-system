import type { Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import type { AuthRequest } from './auth.js';

export type SubjectClassPair = { subjectId: number; classId: number; subjectName?: string };
export type GradeAccessAction = 'view' | 'edit';

declare module './auth.js' {
  interface AuthRequest {
    allowedSubjectClassPairs?: SubjectClassPair[];
    gradeAccessRole?: 'admin' | 'headmaster' | 'teacher' | 'denied';
  }
}

const ADMIN_ROLES = new Set(['super-admin', 'administrator', 'admin', 'headmaster']);
const TEACHER_ROLES = new Set(['teacher', 'staff', 'headmaster']);
const BLOCKED_ROLES = new Set(['finance']);

function normalizeRole(role: string | undefined): string {
  return String(role || '').toLowerCase().trim();
}

export async function loadTeacherSubjectClassPairs(
  tenantId: number,
  teacherId: number
): Promise<SubjectClassPair[]> {
  const res = await query(
    `SELECT tsc.subject_id, tsc.class_id, s.name AS subject_name
     FROM teacher_subject_classes tsc
     JOIN subjects s ON s.id = tsc.subject_id AND s.tenant_id = tsc.tenant_id
     WHERE tsc.tenant_id = $1 AND tsc.teacher_id = $2`,
    [tenantId, teacherId]
  );
  return res.rows.map((r) => ({
    subjectId: Number(r.subject_id),
    classId: Number(r.class_id),
    subjectName: String(r.subject_name),
  }));
}

export function teacherCanAccessSubjectClass(
  pairs: SubjectClassPair[],
  subjectId: number,
  classId: number
): boolean {
  return pairs.some((p) => p.subjectId === subjectId && p.classId === classId);
}

export function teacherCanAccessSubjectName(
  pairs: SubjectClassPair[],
  subjectName: string,
  classId: number
): boolean {
  const norm = subjectName.trim().toLowerCase();
  return pairs.some(
    (p) => p.classId === classId && String(p.subjectName || '').trim().toLowerCase() === norm
  );
}

export async function resolveTeacherIdFromUser(
  tenantId: number,
  user: AuthRequest['user']
): Promise<number | null> {
  if (!user?.teacherId) return null;
  const tid = parseInt(String(user.teacherId), 10);
  if (Number.isNaN(tid)) return null;
  const check = await query(`SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2`, [tid, tenantId]);
  return check.rows.length > 0 ? tid : null;
}

export async function attachGradeAccessContext(req: AuthRequest): Promise<void> {
  const tenantId = req.user!.tenantId!;
  const role = normalizeRole(req.user!.role);

  if (BLOCKED_ROLES.has(role)) {
    req.gradeAccessRole = 'denied';
    req.allowedSubjectClassPairs = [];
    return;
  }

  if (ADMIN_ROLES.has(role)) {
    req.gradeAccessRole = role === 'headmaster' ? 'headmaster' : 'admin';
    req.allowedSubjectClassPairs = [];
    return;
  }

  if (TEACHER_ROLES.has(role)) {
    req.gradeAccessRole = 'teacher';
    const teacherId = await resolveTeacherIdFromUser(tenantId, req.user);
    req.allowedSubjectClassPairs = teacherId
      ? await loadTeacherSubjectClassPairs(tenantId, teacherId)
      : [];
    return;
  }

  req.gradeAccessRole = 'denied';
  req.allowedSubjectClassPairs = [];
}

export function requireGradeAccess(action: GradeAccessAction = 'view') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    await attachGradeAccessContext(req);

    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to grades' });
    }

    const classId = parseInt(String(req.query.classId ?? req.body?.classId ?? ''), 10);
    const subjectId = parseInt(String(req.query.subjectId ?? req.body?.subjectId ?? ''), 10);

    if (req.gradeAccessRole === 'teacher' && !Number.isNaN(classId) && !Number.isNaN(subjectId)) {
      const pairs = req.allowedSubjectClassPairs || [];
      if (!teacherCanAccessSubjectClass(pairs, subjectId, classId)) {
        return res.status(403).json({ error: 'You are not assigned to this subject and class' });
      }
    }

    if (action === 'edit' && req.gradeAccessRole === 'teacher') {
      // Additional edit checks applied per-route (e.g. created_by for assessment metadata)
    }

    next();
  };
}

export function isAdminGradeRole(req: AuthRequest): boolean {
  return req.gradeAccessRole === 'admin' || req.gradeAccessRole === 'headmaster';
}
