import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const router = express.Router();

/** Built-in levels every school sees; custom rows are stored per tenant. */
export const DEFAULT_CLASS_LEVELS = [
  'Crèche',
  'Nursery 1',
  'Nursery 2',
  'KG1',
  'KG2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JHS 1',
  'JHS 2',
  'JHS 3',
] as const;

const norm = (s: string) => s.trim().toLowerCase();

const emitLevelsChanged = (tenantId: number) => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'class-levels',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    // ignore
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'School context required (tenant)' });
    }

    const customResult = await query(
      `SELECT id, name FROM school_class_levels WHERE tenant_id = $1 ORDER BY lower(name)`,
      [tenantId]
    );

    const custom = customResult.rows as { id: number; name: string }[];
    const defaultSet = new Set(DEFAULT_CLASS_LEVELS.map(norm));
    const extraCustom = custom.filter((c) => !defaultSet.has(norm(c.name)));

    const levelNames = [...DEFAULT_CLASS_LEVELS, ...extraCustom.map((c) => c.name)];

    res.json({
      defaults: [...DEFAULT_CLASS_LEVELS],
      custom,
      levels: levelNames,
    });
  } catch (error) {
    console.error('Get class levels error:', error);
    res.status(500).json({ error: 'Failed to fetch class levels' });
  }
});

router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'School context required (tenant)' });
    }

    const raw = typeof req.body?.name === 'string' ? req.body.name : '';
    const name = raw.trim();
    if (!name || name.length > 120) {
      return res.status(400).json({ error: 'Level name is required (max 120 characters)' });
    }

    if (DEFAULT_CLASS_LEVELS.some((d) => norm(d) === norm(name))) {
      return res.status(400).json({ error: 'This level is already included as a standard option' });
    }

    const dup = await query(
      `SELECT id FROM school_class_levels WHERE tenant_id = $1 AND lower(trim(name)) = lower(trim($2))`,
      [tenantId, name]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'This level already exists for your school' });
    }

    const ins = await query(
      `INSERT INTO school_class_levels (tenant_id, name) VALUES ($1, $2) RETURNING id, name`,
      [tenantId, name]
    );

    emitLevelsChanged(tenantId);
    res.status(201).json(ins.rows[0]);
  } catch (error: any) {
    console.error('Create class level error:', error);
    if (error?.code === '23505') {
      return res.status(400).json({ error: 'This level already exists for your school' });
    }
    res.status(500).json({ error: 'Failed to add class level' });
  }
});

router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'School context required (tenant)' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const del = await query(
      `DELETE FROM school_class_levels WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    emitLevelsChanged(tenantId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete class level error:', error);
    res.status(500).json({ error: 'Failed to remove class level' });
  }
});

export default router;
