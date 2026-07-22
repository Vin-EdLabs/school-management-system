import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { resolveTeacherIdFromUser } from '../middleware/requireGradeAccess.js';
import { getIO } from '../socket.js';
import {
  copyClassTimetable,
  createClassTimetableSlot,
  createExam,
  createPeriod,
  deleteClassTimetableSlot,
  deleteExam,
  deletePeriod,
  getClassTimetableGrid,
  getTeacherClassTimetable,
  getTeacherExamTimetable,
  listExamTimetable,
  listClassTeachingAssignments,
  listPeriods,
  ensureDefaultPeriods,
  addPeriodColumn,
  listTeachersForSubjectClass,
  updateClassTimetableSlot,
  updateExam,
  updatePeriod,
  type TimetableDay,
} from '../services/timetableService.js';

const router = express.Router();

const manageRoles = requireRole('administrator', 'headmaster');

const emitChanged = (tenantId: number, entity: string) => {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action: 'updated', at: Date.now() });
  } catch {
    /* ignore */
  }
};

function handleServiceError(res: express.Response, error: unknown) {
  const err = error as Error & { code?: string; conflict?: unknown };
  if (err.code === 'TEACHER_CONFLICT') {
    return res.status(409).json({ error: err.message, code: err.code, conflict: err.conflict });
  }
  return res.status(400).json({ error: err.message || 'Request failed' });
}

async function assertTeacherAccess(req: AuthRequest, teacherId: number): Promise<boolean> {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'administrator' || role === 'headmaster' || req.user?.isPrimaryAdmin) return true;
  if (role === 'teacher' || role === 'staff') {
    const ownId = await resolveTeacherIdFromUser(req.user!.tenantId!, req.user!);
    return ownId === teacherId;
  }
  return true;
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

/** GET /api/timetable/periods */
router.get('/periods', async (req: AuthRequest, res) => {
  try {
    const rows = await listPeriods(req.user!.tenantId!);
    return res.json(rows);
  } catch (error) {
    console.error('List periods error:', error);
    return res.status(500).json({ error: 'Failed to load periods' });
  }
});

/** POST /api/timetable/periods */
router.post('/periods', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, start_time, end_time, order_index, is_break } = req.body || {};
    const row = await createPeriod(tenantId, { name, start_time, end_time, order_index, is_break });
    emitChanged(tenantId, 'timetable-periods');
    return res.status(201).json(row);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** PUT /api/timetable/periods/:id */
router.put('/periods/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const periodId = parseInt(String(req.params.id), 10);
    const row = await updatePeriod(tenantId, periodId, req.body || {});
    emitChanged(tenantId, 'timetable-periods');
    return res.json(row);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** DELETE /api/timetable/periods/:id */
router.delete('/periods/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const periodId = parseInt(String(req.params.id), 10);
    await deletePeriod(tenantId, periodId);
    emitChanged(tenantId, 'timetable-periods');
    return res.json({ success: true });
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** POST /api/timetable/periods/add-column */
router.post('/periods/add-column', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.body?.class_id), 10);
    const termId = parseInt(String(req.body?.term_id), 10);
    if (!Number.isInteger(classId) || !Number.isInteger(termId)) {
      return res.status(400).json({ error: 'class_id and term_id are required' });
    }
    const row = await addPeriodColumn(tenantId, classId, termId);
    emitChanged(tenantId, 'timetable-periods');
    return res.status(201).json(row);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/class-assignments?class_id= */
router.get('/class-assignments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.query.class_id), 10);
    if (!Number.isInteger(classId)) {
      return res.status(400).json({ error: 'class_id is required' });
    }
    const rows = await listClassTeachingAssignments(tenantId, classId);
    return res.json(rows);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/subject-teachers?subject_id=&class_id= */
router.get('/subject-teachers', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const subjectId = parseInt(String(req.query.subject_id), 10);
    const classId = parseInt(String(req.query.class_id), 10);
    if (!Number.isInteger(subjectId) || !Number.isInteger(classId)) {
      return res.status(400).json({ error: 'subject_id and class_id are required' });
    }
    const rows = await listTeachersForSubjectClass(tenantId, subjectId, classId);
    return res.json(rows);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/class/:class_id?term_id= */
router.get('/class/:class_id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.params.class_id), 10);
    const termId = parseInt(String(req.query.term_id), 10);
    if (!Number.isInteger(classId) || !Number.isInteger(termId)) {
      return res.status(400).json({ error: 'class_id and term_id are required' });
    }
    const grid = await getClassTimetableGrid(tenantId, classId, termId);
    return res.json(grid);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** POST /api/timetable/class */
router.post('/class', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const body = req.body || {};
    const slot = await createClassTimetableSlot(tenantId, {
      class_id: Number(body.class_id),
      term_id: Number(body.term_id),
      day_of_week: body.day_of_week as TimetableDay,
      period_id: Number(body.period_id),
      subject_id: Number(body.subject_id),
      teacher_id: body.teacher_id ?? null,
      force: Boolean(body.force),
    });
    emitChanged(tenantId, 'class-timetable');
    return res.status(201).json(slot);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** POST /api/timetable/class/copy */
router.post('/class/copy', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const body = req.body || {};
    const result = await copyClassTimetable(tenantId, {
      class_id: Number(body.class_id),
      from_term_id: Number(body.from_term_id),
      to_term_id: Number(body.to_term_id),
    });
    emitChanged(tenantId, 'class-timetable');
    return res.json(result);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** PUT /api/timetable/class/:id */
router.put('/class/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const slotId = parseInt(String(req.params.id), 10);
    const body = req.body || {};
    const slot = await updateClassTimetableSlot(tenantId, slotId, {
      subject_id: body.subject_id != null ? Number(body.subject_id) : undefined,
      teacher_id: body.teacher_id !== undefined ? (body.teacher_id ? Number(body.teacher_id) : null) : undefined,
      force: Boolean(body.force),
    });
    emitChanged(tenantId, 'class-timetable');
    return res.json(slot);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** DELETE /api/timetable/class/:id */
router.delete('/class/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const slotId = parseInt(String(req.params.id), 10);
    await deleteClassTimetableSlot(tenantId, slotId);
    emitChanged(tenantId, 'class-timetable');
    return res.json({ success: true });
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/teacher/:teacher_id?term_id= */
router.get('/teacher/:teacher_id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(String(req.params.teacher_id), 10);
    const termId = parseInt(String(req.query.term_id), 10);
    if (!Number.isInteger(teacherId) || !Number.isInteger(termId)) {
      return res.status(400).json({ error: 'teacher_id and term_id are required' });
    }
    if (!(await assertTeacherAccess(req, teacherId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const grid = await getTeacherClassTimetable(tenantId, teacherId, termId);
    return res.json(grid);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/exam?class_id=&term_id= */
router.get('/exam', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = parseInt(String(req.query.term_id), 10);
    if (!Number.isInteger(termId)) return res.status(400).json({ error: 'term_id is required' });
    const classIdRaw = req.query.class_id;
    const classId = classIdRaw != null && String(classIdRaw).trim() !== ''
      ? parseInt(String(classIdRaw), 10)
      : undefined;
    const rows = await listExamTimetable(tenantId, { term_id: termId, class_id: classId });
    return res.json(rows);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** POST /api/timetable/exam */
router.post('/exam', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const body = req.body || {};
    const row = await createExam(tenantId, {
      class_id: Number(body.class_id),
      term_id: Number(body.term_id),
      subject_id: Number(body.subject_id),
      exam_date: body.exam_date,
      start_time: body.start_time,
      end_time: body.end_time,
      venue: body.venue,
      notes: body.notes,
    });
    emitChanged(tenantId, 'exam-timetable');
    return res.status(201).json(row);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** PUT /api/timetable/exam/:id */
router.put('/exam/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const examId = parseInt(String(req.params.id), 10);
    const body = req.body || {};
    const row = await updateExam(tenantId, examId, {
      class_id: body.class_id != null ? Number(body.class_id) : undefined,
      term_id: body.term_id != null ? Number(body.term_id) : undefined,
      subject_id: body.subject_id != null ? Number(body.subject_id) : undefined,
      exam_date: body.exam_date,
      start_time: body.start_time,
      end_time: body.end_time,
      venue: body.venue,
      notes: body.notes,
    });
    emitChanged(tenantId, 'exam-timetable');
    return res.json(row);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** DELETE /api/timetable/exam/:id */
router.delete('/exam/:id', manageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const examId = parseInt(String(req.params.id), 10);
    await deleteExam(tenantId, examId);
    emitChanged(tenantId, 'exam-timetable');
    return res.json({ success: true });
  } catch (error) {
    return handleServiceError(res, error);
  }
});

/** GET /api/timetable/exam/teacher/:teacher_id?term_id= */
router.get('/exam/teacher/:teacher_id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(String(req.params.teacher_id), 10);
    const termId = parseInt(String(req.query.term_id), 10);
    if (!Number.isInteger(teacherId) || !Number.isInteger(termId)) {
      return res.status(400).json({ error: 'teacher_id and term_id are required' });
    }
    if (!(await assertTeacherAccess(req, teacherId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = await getTeacherExamTimetable(tenantId, teacherId, termId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error);
  }
});

export default router;
