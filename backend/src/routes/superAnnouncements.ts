import express, { Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  createGlobalAnnouncement,
  deleteGlobalAnnouncement,
  listGlobalAnnouncements,
  toggleGlobalAnnouncement,
  updateGlobalAnnouncement,
  getAnnouncementReaders,
  emitGlobalAnnouncementLiveEvent,
  type AnnouncementType,
} from '../services/globalAnnouncementService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('super-admin'));

const announcementSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  type: z.enum(['info', 'warning', 'maintenance', 'update', 'urgent']).optional(),
  target: z.enum(['all', 'selected']).optional(),
  targetTenantIds: z.array(z.coerce.number().int()).optional().nullable(),
  scheduledAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const items = await listGlobalAnnouncements();
    res.json({ items });
  } catch (error) {
    console.error('List announcements error:', error);
    res.status(500).json({ error: 'Failed to list announcements' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = announcementSchema.parse(req.body);
    if (body.target === 'selected' && (!body.targetTenantIds || body.targetTenantIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one school for targeted announcements' });
    }

    const created = await createGlobalAnnouncement(
      {
        title: body.title,
        body: body.body,
        type: body.type as AnnouncementType,
        target: body.target,
        targetTenantIds: body.targetTenantIds ?? null,
        scheduledAt: body.scheduledAt ?? null,
        expiresAt: body.expiresAt ?? null,
        isActive: body.isActive,
      },
      req.user!.id
    );

    await emitGlobalAnnouncementLiveEvent(created);

    await writeAuditLog({
      tenantId: null,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'global_announcement',
      entityId: created.id,
      module: 'superadmin',
      summary: `Announcement created: ${created.title}`,
      details: {
        title: created.title,
        type: created.type,
        target: created.target,
        targetTenantIds: created.target_tenant_ids,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0]?.message || 'Invalid input' });
    }
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const body = announcementSchema.parse(req.body);
    if (body.target === 'selected' && (!body.targetTenantIds || body.targetTenantIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one school for targeted announcements' });
    }

    const updated = await updateGlobalAnnouncement(id, {
      title: body.title,
      body: body.body,
      type: body.type as AnnouncementType,
      target: body.target,
      targetTenantIds: body.targetTenantIds ?? null,
      scheduledAt: body.scheduledAt ?? null,
      expiresAt: body.expiresAt ?? null,
      isActive: body.isActive,
    });
    if (!updated) return res.status(404).json({ error: 'Announcement not found' });

    await emitGlobalAnnouncementLiveEvent(updated);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0]?.message || 'Invalid input' });
    }
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await deleteGlobalAnnouncement(id);
    if (!result.deleted) return res.status(404).json({ error: 'Announcement not found' });

    await writeAuditLog({
      tenantId: null,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'global_announcement',
      entityId: id,
      module: 'superadmin',
      summary: `Announcement deleted: ${result.title}`,
      details: {
        title: result.title,
        schoolsReached: result.schoolsReached,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const updated = await toggleGlobalAnnouncement(id);
    if (!updated) return res.status(404).json({ error: 'Announcement not found' });

    await emitGlobalAnnouncementLiveEvent(updated);

    await writeAuditLog({
      tenantId: null,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'ANNOUNCEMENT_TOGGLED',
      entityType: 'global_announcement',
      entityId: id,
      module: 'superadmin',
      summary: `Announcement ${updated.is_active ? 'activated' : 'deactivated'}: ${updated.title}`,
      details: {
        title: updated.title,
        isActive: updated.is_active,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    res.json(updated);
  } catch (error) {
    console.error('Toggle announcement error:', error);
    res.status(500).json({ error: 'Failed to toggle announcement' });
  }
});

router.get('/:id/reads', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const readers = await getAnnouncementReaders(id);
    res.json({ readers });
  } catch (error) {
    console.error('Get announcement readers error:', error);
    res.status(500).json({ error: 'Failed to get announcement readers' });
  }
});

export default router;
