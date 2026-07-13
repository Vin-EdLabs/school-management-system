import express from 'express';
import {
  authenticate,
  requireRole,
  requireTenant,
  type AuthRequest,
} from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  createComplaint,
  getComplaintById,
  listComplaints,
  listTeacherSubjects,
  listUnreadComplaintNotifications,
  markComplaintNotificationRead,
  updateComplaintStatus,
  type ComplaintSeverity,
  type ComplaintStatus,
  type ComplaintType,
} from '../services/complaintsService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

const TEACHER_ROLES = ['teacher', 'staff'] as const;
const VIEW_ROLES = ['super-admin', 'administrator', 'headmaster'] as const;
const ADMIN_ROLES = ['super-admin', 'administrator'] as const;

function tenantIdOf(req: AuthRequest): number {
  return Number(req.user!.tenantId);
}

function handleError(res: express.Response, err: unknown) {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : 'Request failed';
  if (status >= 500) console.error('Complaints error:', err);
  return res.status(status).json({ error: message });
}

/** GET /notifications/unread — admin/headmaster */
router.get(
  '/notifications/unread',
  requireRole(...VIEW_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const items = await listUnreadComplaintNotifications(tenantIdOf(req));
      res.json({ items });
    } catch (err) {
      handleError(res, err);
    }
  }
);

/** POST /notifications/:id/read */
router.post(
  '/notifications/:id/read',
  requireRole(...VIEW_ROLES),
  async (req: AuthRequest, res) => {
    try {
      await markComplaintNotificationRead(tenantIdOf(req), Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err);
    }
  }
);

/** GET /subjects/teachers — teachers for complaint subject picker */
router.get(
  '/subjects/teachers',
  requireRole(...TEACHER_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const items = await listTeacherSubjects(tenantIdOf(req), Number(req.user!.id));
      res.json({ items });
    } catch (err) {
      handleError(res, err);
    }
  }
);

/** POST / — teachers file a complaint */
router.post('/', requireRole(...TEACHER_ROLES), async (req: AuthRequest, res) => {
  try {
    const created = await createComplaint(tenantIdOf(req), Number(req.user!.id), req.body || {});
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

/** GET /my — complaints filed by current teacher */
router.get('/my', requireRole(...TEACHER_ROLES), async (req: AuthRequest, res) => {
  try {
    const data = await listComplaints(
      tenantIdOf(req),
      {
        complaint_type: req.query.complaint_type as ComplaintType | undefined,
        status: req.query.status as ComplaintStatus | 'active' | undefined,
        severity: req.query.severity as ComplaintSeverity | undefined,
        date_from: req.query.date_from ? String(req.query.date_from) : undefined,
        date_to: req.query.date_to ? String(req.query.date_to) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        filed_by: Number(req.user!.id),
      },
      false
    );
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

/** GET / — admin/headmaster list */
router.get('/', requireRole(...VIEW_ROLES), async (req: AuthRequest, res) => {
  try {
    const data = await listComplaints(
      tenantIdOf(req),
      {
        complaint_type: req.query.complaint_type as ComplaintType | undefined,
        status: req.query.status as ComplaintStatus | 'active' | undefined,
        severity: req.query.severity as ComplaintSeverity | undefined,
        date_from: req.query.date_from ? String(req.query.date_from) : undefined,
        date_to: req.query.date_to ? String(req.query.date_to) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      },
      true
    );
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

/** GET /:id */
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const role = String(req.user!.role || '');
    const forAdmin = VIEW_ROLES.includes(role as (typeof VIEW_ROLES)[number]);
    const isTeacher = TEACHER_ROLES.includes(role as (typeof TEACHER_ROLES)[number]);
    if (!forAdmin && !isTeacher) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const detail = await getComplaintById(tenantIdOf(req), Number(req.params.id), {
      forAdmin,
      requesterId: Number(req.user!.id),
    });
    res.json(detail);
  } catch (err) {
    handleError(res, err);
  }
});

/** PATCH /:id/status — admin only (not headmaster) */
router.patch(
  '/:id/status',
  requireRole(...ADMIN_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const updated = await updateComplaintStatus(
        tenantIdOf(req),
        Number(req.params.id),
        Number(req.user!.id),
        req.body || {}
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  }
);

export default router;
