import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  canStartImpersonation,
  loadStaffUserById,
  resolveStaffTargetByIdentifier,
  resolveStudentForParentPortal,
  ensureParentAccountForStudent,
  searchImpersonationTargets,
  signStaffImpersonationToken,
  signParentImpersonationToken,
  signAdminRestoreToken,
  assertCanImpersonateStaff,
  assertCanImpersonateParent,
  logImpersonationStart,
  logImpersonationEnd,
  isPlatformSuperAdminActor,
  type ImpersonatorActor,
} from '../services/impersonationService.js';

function resolveImpersonationTenantId(actor: ImpersonatorActor, bodyTenantId: unknown): number {
  if (isPlatformSuperAdminActor(actor)) {
    const tid = parseInt(String(bodyTenantId ?? ''), 10);
    if (!tid || Number.isNaN(tid)) {
      throw new Error('School context required');
    }
    return tid;
  }
  if (!actor.tenantId || Number.isNaN(actor.tenantId)) {
    throw new Error('School context required');
  }
  return actor.tenantId;
}
import { query } from '../db/connection.js';

const router = express.Router();

/** Exit impersonation — MUST be before admin middleware (uses teacher/parent impersonation JWT) */
router.post('/exit', async (req, res) => {
  try {
    const authHeader = req.headers.authorization?.split(' ')[1];
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(authHeader, process.env.JWT_SECRET || 'secret') as any;
    const impersonatorId = decoded.impersonatorId ? parseInt(String(decoded.impersonatorId), 10) : null;
    if (!impersonatorId) {
      return res.status(400).json({ error: 'Not in impersonation mode' });
    }

    const admin = await loadStaffUserById(impersonatorId);
    if (!admin) return res.status(404).json({ error: 'Original admin session not found' });

    const actor: ImpersonatorActor = {
      id: admin.id,
      tenantId: admin.tenantId,
      role: admin.role,
      username: admin.username,
      fullName: admin.fullName,
      isPrimaryAdmin: admin.isPrimaryAdmin,
    };

    const token = signAdminRestoreToken(actor);
    const targetLabel =
      decoded.role === 'parent'
        ? `parent portal (student #${decoded.studentId})`
        : `${decoded.userId}`;

    await logImpersonationEnd(
      actor,
      `${actor.fullName || actor.username} exited impersonation of ${targetLabel}`,
      {
        mode: decoded.role === 'parent' ? 'parent' : 'staff',
        targetLabel,
        targetTenantId: decoded.tenantId != null ? parseInt(String(decoded.tenantId), 10) : null,
      },
      getClientIp(req),
      req.get('user-agent') || null
    );

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
        tenantId: admin.tenantId,
        teacherId: admin.teacherId,
        otherStaffId: admin.otherStaffId,
        isPrimaryAdmin: admin.isPrimaryAdmin,
      },
      impersonation: { active: false },
    });
  } catch (error) {
    console.error('impersonation exit error:', error);
    res.status(500).json({ error: 'Failed to exit impersonation' });
  }
});

router.use(authenticate);
router.use(requirePrimaryAdminOrSuperAdmin);

function actorFromReq(req: AuthRequest): ImpersonatorActor {
  const u = req.user!;
  return {
    id: u.id,
    tenantId: u.tenantId,
    role: u.role,
    username: u.username,
    fullName: u.fullName,
    isPrimaryAdmin: u.isPrimaryAdmin,
  };
}

function rejectIfAlreadyImpersonating(req: AuthRequest, res: express.Response) {
  if (req.impersonator) {
    res.status(403).json({ error: 'Already impersonating. Exit first.' });
    return true;
  }
  return false;
}

/** Search users / students within a tenant (super admin + school admin) */
router.get('/targets', async (req: AuthRequest, res) => {
  try {
    const actor = actorFromReq(req);
    if (!canStartImpersonation(actor)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const q = String(req.query.q || '').trim();
    const tenantIdRaw = req.query.tenantId ?? req.user!.tenantId;
    const tenantId = parseInt(String(tenantIdRaw), 10);
    if (!tenantId || Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    if (!isPlatformSuperAdminActor(actor) && actor.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Cross-tenant search denied' });
    }

    const rows = await searchImpersonationTargets(tenantId, q);
    res.json({ items: rows });
  } catch (error) {
    console.error('impersonation targets error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/** Start staff impersonation */
router.post('/start', async (req: AuthRequest, res) => {
  try {
    if (rejectIfAlreadyImpersonating(req, res)) return;
    const actor = actorFromReq(req);
    if (!canStartImpersonation(actor)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { targetUserId, identifier, tenantId: bodyTenantId } = req.body || {};
    let tenantId: number;
    try {
      tenantId = resolveImpersonationTenantId(actor, bodyTenantId);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'School context required' });
    }

    let target = null as Awaited<ReturnType<typeof loadStaffUserById>>;
    if (targetUserId) {
      target = await loadStaffUserById(parseInt(String(targetUserId), 10));
      if (target && target.tenantId !== tenantId) target = null;
    } else if (identifier) {
      target = await resolveStaffTargetByIdentifier(tenantId, String(identifier));
    } else {
      return res.status(400).json({ error: 'targetUserId or identifier required' });
    }

    if (!target) {
      return res.status(404).json({ error: 'User not found in this school' });
    }

    assertCanImpersonateStaff(actor, target);

    const tenantRes = await query('SELECT id, name FROM tenants WHERE id = $1', [target.tenantId]);
    const schoolName = tenantRes.rows[0]?.name || 'School';

    const token = signStaffImpersonationToken(actor, target);
    const summary = `${actor.fullName || actor.username} started viewing as ${target.fullName} (${target.role})`;
    await logImpersonationStart(
      actor,
      summary,
      {
        mode: 'staff',
        targetUserId: target.id,
        targetUsername: target.username,
        targetName: target.fullName,
        targetRole: target.role,
        targetTenantId: target.tenantId,
      },
      getClientIp(req),
      req.get('user-agent') || null
    );

    res.json({
      mode: 'staff',
      token,
      user: {
        id: target.id,
        username: target.username,
        fullName: target.fullName,
        role: target.role,
        tenantId: target.tenantId,
        teacherId: target.teacherId,
        otherStaffId: target.otherStaffId,
        isPrimaryAdmin: target.isPrimaryAdmin,
      },
      impersonation: {
        active: true,
        targetName: target.fullName,
        targetRole: target.role,
        schoolName,
        impersonatorId: actor.id,
        impersonatorName: actor.fullName || actor.username,
      },
    });
  } catch (error: any) {
    const msg = error?.message || 'Impersonation failed';
    res.status(error?.message?.includes('Cannot') || error?.message?.includes('cannot') ? 403 : 500).json({ error: msg });
  }
});

/** Start parent portal impersonation (creates portal account if missing) */
router.post('/start-parent', async (req: AuthRequest, res) => {
  try {
    if (rejectIfAlreadyImpersonating(req, res)) return;
    const actor = actorFromReq(req);
    if (!canStartImpersonation(actor)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { identifier, studentId, tenantId: bodyTenantId } = req.body || {};
    let tenantId: number;
    try {
      tenantId = resolveImpersonationTenantId(actor, bodyTenantId);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'School context required' });
    }

    assertCanImpersonateParent(actor, tenantId);

    let studentPk = studentId ? parseInt(String(studentId), 10) : NaN;
    let studentDisplayId = '';
    let studentName = '';

    if (identifier) {
      const student = await resolveStudentForParentPortal(tenantId, String(identifier));
      if (!student) {
        return res.status(404).json({ error: 'Student not found in this school' });
      }
      studentPk = student.studentPk;
      studentDisplayId = student.studentDisplayId;
      studentName = student.studentName;
    } else if (!Number.isNaN(studentPk)) {
      const row = await query(
        `SELECT student_id, admission_number, first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
        [studentPk, tenantId]
      );
      if (row.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }
      studentDisplayId = row.rows[0].student_id || row.rows[0].admission_number;
      studentName = `${row.rows[0].first_name || ''} ${row.rows[0].last_name || ''}`.trim();
    } else {
      return res.status(400).json({ error: 'identifier or studentId required' });
    }

    const parentAccountId = await ensureParentAccountForStudent(tenantId, studentPk);
    await query('UPDATE parent_portal_accounts SET must_change_password = false WHERE id = $1', [
      parentAccountId,
    ]);
    const tenantRes = await query('SELECT name, slug FROM tenants WHERE id = $1', [tenantId]);
    const schoolName = tenantRes.rows[0]?.name || 'School';
    const schoolSlug = tenantRes.rows[0]?.slug || null;

    const token = signParentImpersonationToken(actor, parentAccountId, studentPk, tenantId);
    const summary = `${actor.fullName || actor.username} started parent portal view for ${studentName} (${studentDisplayId})`;
    await logImpersonationStart(
      actor,
      summary,
      {
        mode: 'parent',
        parentAccountId,
        studentId: studentPk,
        studentDisplayId,
        studentName,
        targetTenantId: tenantId,
      },
      getClientIp(req),
      req.get('user-agent') || null
    );

    res.json({
      mode: 'parent',
      token,
      tenantId,
      schoolSlug,
      schoolName,
      student: { id: studentPk, name: studentName, studentId: studentDisplayId },
      impersonation: {
        active: true,
        targetName: studentName,
        targetRole: 'parent',
        schoolName,
        impersonatorId: actor.id,
        impersonatorName: actor.fullName || actor.username,
      },
    });
  } catch (error: any) {
    console.error('parent impersonation error:', error);
    res.status(500).json({ error: error?.message || 'Parent impersonation failed' });
  }
});

/** School admin shortcut: staff ID first, then parent portal by student ID */
router.post('/start-auto', async (req: AuthRequest, res) => {
  try {
    if (rejectIfAlreadyImpersonating(req, res)) return;
    const actor = actorFromReq(req);
    if (!canStartImpersonation(actor)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { identifier, tenantId: bodyTenantId } = req.body || {};
    const id = String(identifier || '').trim();
    if (!id) return res.status(400).json({ error: 'identifier required' });

    let tenantId: number;
    try {
      tenantId = resolveImpersonationTenantId(actor, bodyTenantId);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'School context required' });
    }

    const staff = await resolveStaffTargetByIdentifier(tenantId, id);
    if (staff) {
      assertCanImpersonateStaff(actor, staff);
      const tenantRes = await query('SELECT id, name FROM tenants WHERE id = $1', [staff.tenantId]);
      const schoolName = tenantRes.rows[0]?.name || 'School';
      const token = signStaffImpersonationToken(actor, staff);
      await logImpersonationStart(
        actor,
        `${actor.fullName || actor.username} started viewing as ${staff.fullName} (${staff.role})`,
        { mode: 'staff', targetUserId: staff.id, targetName: staff.fullName, targetRole: staff.role, targetTenantId: staff.tenantId },
        getClientIp(req),
        req.get('user-agent') || null
      );
      return res.json({
        mode: 'staff',
        token,
        user: {
          id: staff.id,
          username: staff.username,
          fullName: staff.fullName,
          role: staff.role,
          tenantId: staff.tenantId,
          teacherId: staff.teacherId,
          otherStaffId: staff.otherStaffId,
          isPrimaryAdmin: staff.isPrimaryAdmin,
        },
        impersonation: {
          active: true,
          targetName: staff.fullName,
          targetRole: staff.role,
          schoolName,
          impersonatorId: actor.id,
          impersonatorName: actor.fullName || actor.username,
        },
      });
    }

    const student = await resolveStudentForParentPortal(tenantId, id);
    if (student) {
      assertCanImpersonateParent(actor, tenantId);
      const parentAccountId = await ensureParentAccountForStudent(tenantId, student.studentPk);
      await query('UPDATE parent_portal_accounts SET must_change_password = false WHERE id = $1', [
        parentAccountId,
      ]);
      const tenantRes = await query('SELECT name, slug FROM tenants WHERE id = $1', [tenantId]);
      const schoolName = tenantRes.rows[0]?.name || 'School';
      const schoolSlug = tenantRes.rows[0]?.slug || null;
      const token = signParentImpersonationToken(actor, parentAccountId, student.studentPk, tenantId);
      await logImpersonationStart(
        actor,
        `${actor.fullName || actor.username} started parent portal view for ${student.studentName}`,
        { mode: 'parent', studentId: student.studentPk, studentName: student.studentName, targetTenantId: tenantId },
        getClientIp(req),
        req.get('user-agent') || null
      );
      return res.json({
        mode: 'parent',
        token,
        tenantId,
        schoolSlug,
        schoolName,
        student: { id: student.studentPk, name: student.studentName, studentId: student.studentDisplayId },
        impersonation: {
          active: true,
          targetName: student.studentName,
          targetRole: 'parent',
          schoolName,
          impersonatorId: actor.id,
          impersonatorName: actor.fullName || actor.username,
        },
      });
    }

    return res.status(404).json({ error: 'No teacher, staff user, or student matched that ID' });
  } catch (error: any) {
    const msg = error?.message || 'Failed';
    res.status(msg.includes('Cannot') || msg.includes('cannot') || msg.includes('only') ? 403 : 500).json({ error: msg });
  }
});

export default router;
