import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { notifySetupProgressChanged } from '../services/setupProgressService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
    try {
        const io = getIO();
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
    } catch {
        // Socket server may be unavailable in some non-realtime contexts.
    }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/**
 * GET /api/subjects
 * Get all subjects for the school
 */
router.get('/', async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId!;
        const result = await query(
            'SELECT * FROM subjects WHERE tenant_id = $1 ORDER BY name ASC',
            [tenantId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

/**
 * POST /api/subjects
 * Create a new subject
 */
router.post('/', async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId!;
        const { name, code, level } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Subject name is required' });
        }

        const result = await query(
            `INSERT INTO subjects (tenant_id, name, code, level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [tenantId, name, code || null, level || null]
        );

        emitTenantDataChanged(tenantId, 'subject', 'created');
        notifySetupProgressChanged(tenantId);
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Create subject error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Subject name already exists' });
        }
        res.status(500).json({ error: 'Failed to create subject' });
    }
});

/**
 * PUT /api/subjects/:id
 * Update a subject
 */
router.put('/:id', async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId!;
        const { id } = req.params;
        const { name, code, level } = req.body;

        const result = await query(
            `UPDATE subjects 
       SET name = COALESCE($1, name), 
           code = COALESCE($2, code), 
           level = COALESCE($3, level),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
            [name, code, level, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        emitTenantDataChanged(tenantId, 'subject', 'updated');
        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Update subject error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Subject name already exists' });
        }
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

/**
 * DELETE /api/subjects/:id
 * Delete a subject
 */
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId!;
        const { id } = req.params;

        const result = await query(
            'DELETE FROM subjects WHERE id = $1 AND tenant_id = $2 RETURNING id',
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        emitTenantDataChanged(tenantId, 'subject', 'deleted');
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

export default router;
