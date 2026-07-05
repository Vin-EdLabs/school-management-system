import express from 'express';
import multer from 'multer';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { sendPushToParentAccount } from '../services/webPushService.js';
import { setTenantContext } from '../middleware/tenant.js';
import { authenticateParent, type ParentAuthRequest } from '../middleware/authenticateParent.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

type ParentRequest = ParentAuthRequest;

async function emitParentDeskToTenant(tenantId: number) {
  try {
    const { getIO } = await import('../socket.js');
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'parent-desk',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    // ignore
  }
}

async function emitParentDeskNotification(tenantId: number, preview: string) {
  try {
    const unreadRow = await query(
      `SELECT COUNT(*)::int AS c
       FROM parent_messages m
       WHERE m.tenant_id = $1
         AND EXISTS (
           SELECT 1 FROM message_replies r
           WHERE r.message_id = m.id
             AND r.sender_type = 'parent'
             AND r.is_read = false
         )`,
      [tenantId]
    );
    const unreadCount = Number(unreadRow.rows[0]?.c ?? 0);
    const { getIO } = await import('../socket.js');
    getIO().to(`tenant:${tenantId}`).emit('new-parent-message', {
      type: 'parent-desk',
      count: unreadCount,
      preview: preview.slice(0, 120),
      timestamp: Date.now(),
    });
  } catch (socketErr) {
    console.error('Parent desk notification emit error:', socketErr);
  }
}

const MESSAGE_TYPES = new Set(['absence', 'fee', 'academic', 'teacher', 'late', 'general']);
const MESSAGE_TYPE_LABEL: Record<string, string> = {
  absence: 'Absence Notice',
  fee: 'Fee Query',
  academic: 'Academic Concern',
  teacher: 'Teacher Concern',
  late: 'Late Arrival',
  general: 'General Enquiry',
};

router.post('/', authenticateParent, upload.single('attachment'), async (req: ParentRequest, res) => {
  try {
    const { type, subject, message, studentId } = req.body;
    const safeType = String(type || '').toLowerCase();
    if (!MESSAGE_TYPES.has(safeType)) return res.status(400).json({ error: 'Invalid message type' });
    if (!message) return res.status(400).json({ error: 'message is required' });

    const attachmentUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : null;

    const selectedStudentId = Number(studentId || req.parent!.studentId);
    const studentInfo = await query(
      `SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
      [selectedStudentId, req.parent!.tenantId]
    ).catch(() => ({ rows: [] as any[] }));
    const studentName = studentInfo.rows[0]
      ? `${studentInfo.rows[0].first_name || ''} ${studentInfo.rows[0].last_name || ''}`.trim()
      : 'Ward';
    const generatedSubject = `${MESSAGE_TYPE_LABEL[safeType] || 'Parent Desk Message'} — ${studentName}`;
    const finalSubject = String(subject || '').trim() || generatedSubject;
    const result = await query(
      `INSERT INTO parent_messages (tenant_id, parent_account_id, student_id, type, subject, message, attachment_url, status, is_read_by_school)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',false)
       RETURNING *`,
      [req.parent!.tenantId, req.parent!.accountId, selectedStudentId, safeType, finalSubject, String(message).trim(), attachmentUrl]
    );

    await emitParentDeskToTenant(req.parent!.tenantId);
    await emitParentDeskNotification(req.parent!.tenantId, String(result.rows[0].message || 'New parent desk message'));
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create parent message error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/unread-count', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS c
       FROM message_replies r
       INNER JOIN parent_messages m ON m.id = r.message_id
       WHERE m.parent_account_id = $1 AND r.sender_type = 'school' AND r.is_read = false`,
      [req.parent!.accountId]
    );
    return res.json({ count: Number(r.rows[0]?.c ?? 0) });
  } catch (error) {
    console.error('Parent messages unread-count error:', error);
    return res.status(500).json({ error: 'Failed to read unread count' });
  }
});

router.get('/', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;
    const rows = await query(
      `SELECT m.*, s.first_name, s.last_name, c.class_name,
              (SELECT COUNT(*)::int FROM message_replies r WHERE r.message_id = m.id AND r.sender_type = 'school' AND r.is_read = false) AS unread_replies
       FROM parent_messages m
       JOIN students s ON s.id = m.student_id AND s.tenant_id = m.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       WHERE m.parent_account_id = $1 AND m.tenant_id = $2
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.parent!.accountId, req.parent!.tenantId, limit, offset]
    );
    const contact = await query(
      `SELECT phone_number, whatsapp_number, email, office_hours, physical_address
       FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
      [req.parent!.tenantId]
    ).catch(() => ({ rows: [{}] as any[] }));
    return res.json({ messages: rows.rows, page, limit, contact: contact.rows[0] || {} });
  } catch (error) {
    console.error('Get parent messages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.get('/:id', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const msg = await query(
      `SELECT m.*, s.first_name, s.last_name, c.class_name
       FROM parent_messages m
       JOIN students s ON s.id = m.student_id AND s.tenant_id = m.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       WHERE m.id = $1 AND m.parent_account_id = $2 AND m.tenant_id = $3`,
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const replies = await query(
      `SELECT id, sender_type, reply_text, attachment_url, is_read, created_at
       FROM message_replies WHERE message_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return res.json({ message: msg.rows[0], replies: replies.rows });
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/:id/reply', authenticateParent, upload.single('attachment'), async (req: ParentRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const replyText = String(req.body?.reply_text || '').trim();
    if (!replyText) return res.status(400).json({ error: 'reply_text is required' });
    const msg = await query(
      'SELECT id FROM parent_messages WHERE id = $1 AND parent_account_id = $2 AND tenant_id = $3',
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const attachmentUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : null;

    const inserted = await query(
      `INSERT INTO message_replies (message_id, sender_type, reply_text, attachment_url, is_read)
       VALUES ($1,'parent',$2,$3,false) RETURNING *`,
      [id, replyText, attachmentUrl]
    );
    await query(`UPDATE parent_messages SET is_read_by_school = false, status = 'pending' WHERE id = $1`, [id]);
    await emitParentDeskToTenant(req.parent!.tenantId);
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    console.error('Parent reply error:', error);
    return res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.put('/:id/read', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    await query(
      `UPDATE message_replies r
       SET is_read = true
       FROM parent_messages m
       WHERE r.message_id = m.id AND m.id = $1 AND m.parent_account_id = $2 AND m.tenant_id = $3 AND r.sender_type = 'school'`,
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Mark message read error:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// -------- Admin side --------
router.get('/admin/list', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rows = await query(
      `SELECT m.*, p.id as parent_account_id, p.last_login,
              s.first_name, s.last_name, s.student_id as admission_number, c.class_name,
              (SELECT COUNT(*)::int FROM message_replies r WHERE r.message_id = m.id AND r.sender_type = 'parent' AND r.is_read = false) AS unread_parent_replies
       FROM parent_messages m
       JOIN parent_portal_accounts p ON p.id = m.parent_account_id
       JOIN students s ON s.id = m.student_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE m.tenant_id = $1
       ORDER BY m.created_at DESC
       LIMIT 200`,
      [tenantId]
    );
    return res.json(rows.rows);
  } catch (error) {
    console.error('Admin parent desk list error:', error);
    return res.status(500).json({ error: 'Failed to fetch parent messages' });
  }
});

router.get('/admin/unread-count', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM parent_messages m
       WHERE m.tenant_id = $1
         AND EXISTS (
           SELECT 1 FROM message_replies r
           WHERE r.message_id = m.id
             AND r.sender_type = 'parent'
             AND r.is_read = false
         )`,
      [tenantId]
    );
    return res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Admin parent desk unread-count error:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.post('/admin/mark-read-by-school', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await query(
      `UPDATE message_replies
       SET is_read = true
       WHERE sender_type = 'parent'
         AND message_id IN (
           SELECT id FROM parent_messages WHERE tenant_id = $1
         )`,
      [tenantId]
    );
    await query(
      `UPDATE parent_messages
       SET is_read_by_school = true
       WHERE tenant_id = $1`,
      [tenantId]
    );
    await emitParentDeskToTenant(tenantId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin parent desk mark-read-by-school error:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.get('/admin/:id', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const msg = await query(
      `SELECT m.*, s.first_name, s.last_name, s.student_id as admission_number, c.class_name
       FROM parent_messages m
       JOIN students s ON s.id = m.student_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [id, tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const replies = await query(
      `SELECT id, sender_type, reply_text, attachment_url, is_read, created_at
       FROM message_replies WHERE message_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    await query(`UPDATE parent_messages SET is_read_by_school = true, status = CASE WHEN status='pending' THEN 'in_review' ELSE status END WHERE id = $1`, [id]);
    await query(`UPDATE message_replies SET is_read = true WHERE message_id = $1 AND sender_type = 'parent'`, [id]);
    await emitParentDeskToTenant(tenantId);
    return res.json({ message: msg.rows[0], replies: replies.rows });
  } catch (error) {
    console.error('Admin conversation fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/admin/:id/reply', authenticate, requireTenant, setTenantContext, upload.single('attachment'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const replyText = String(req.body?.reply_text || '').trim();
    if (!replyText) return res.status(400).json({ error: 'reply_text is required' });
    const msg = await query(
      `SELECT id, parent_account_id, subject
       FROM parent_messages
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const attachmentUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : null;

    const inserted = await query(
      `INSERT INTO message_replies (message_id, sender_type, reply_text, attachment_url, is_read)
       VALUES ($1,'school',$2,$3,false) RETURNING *`,
      [id, replyText, attachmentUrl]
    );
    await query(`UPDATE parent_messages SET status = 'in_review' WHERE id = $1`, [id]);
    await query(
      `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, msg.rows[0].parent_account_id, 'School replied to your Parent Desk message', replyText.slice(0, 300), `/portal/${tenantId}`]
    ).catch(() => {});
    await sendPushToParentAccount(msg.rows[0].parent_account_id, {
      title: 'School replied',
      body: replyText.slice(0, 160),
      url: `/portal/${tenantId}`,
    }).catch(() => {});
    await emitParentDeskToTenant(tenantId);
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    console.error('Admin parent desk reply error:', error);
    return res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.put('/admin/:id/status', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const status = String(req.body?.status || '').toLowerCase();
    if (!['pending', 'in_review', 'resolved', 'urgent'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await query(
      `UPDATE parent_messages SET status = $1 WHERE id = $2 AND tenant_id = $3`,
      [status, id, tenantId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin parent desk status error:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
