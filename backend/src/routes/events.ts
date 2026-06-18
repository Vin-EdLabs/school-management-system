import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';

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
attachWritableTermGuard(router);

const calendarManageRoles = requireRole('super-admin', 'administrator');

// Get all events
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, category } = req.query;
    
    let queryText = 'SELECT * FROM events WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (startDate && endDate) {
      queryText += ` AND event_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(startDate, endDate);
    } else if (startDate) {
      queryText += ` AND event_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (category) {
      queryText += ` AND category = $${params.length + 1}`;
      params.push(category);
    }
    
    queryText += ' ORDER BY event_date ASC, event_time ASC';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM events WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event
router.post('/', calendarManageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { title, description, event_date, event_time, location, category, color, reminder, reminder_time } = req.body;
    
    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }
    
    const result = await query(
      `INSERT INTO events (tenant_id, title, description, event_date, event_time, location, category, color, reminder, reminder_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        tenantId,
        title,
        description || null,
        event_date,
        event_time || null,
        location || null,
        category || null,
        color || null,
        reminder || false,
        reminder_time || null
      ]
    );
    
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'EVENT',
      entityId: result.rows[0].id,
      module: 'general',
      summary: withActor(`Event created — "${title}"`, actor),
      details: { title, event_date },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'event', 'created');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/:id', calendarManageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['title', 'description', 'event_date', 'event_time', 'location', 'category', 'color', 'reminder', 'reminder_time'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add tenant_id and id for WHERE clause
    values.push(tenantId, id);
    
    const result = await query(
      `UPDATE events SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const updatedEvent = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'EVENT',
      entityId: parseInt(id, 10),
      module: 'general',
      summary: withActor(`Event updated — "${updatedEvent.title}"`, actor),
      details: { title: updatedEvent.title, event_date: updatedEvent.event_date },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'event', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', calendarManageRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const existing = await query(
      'SELECT title FROM events WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    const eventTitle = String(existing.rows[0]?.title || 'Event').trim();

    const result = await query(
      'DELETE FROM events WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'EVENT',
      entityId: parseInt(id, 10),
      module: 'general',
      summary: withActor(`Event deleted — "${eventTitle}"`, actor),
      details: { title: eventTitle },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'event', 'deleted');
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
