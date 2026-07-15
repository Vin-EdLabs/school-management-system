import express from 'express';
import multer from 'multer';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { sendPushToParentAccount } from '../services/webPushService.js';
import { notifySchoolStaffOfParentDesk } from '../services/commsNotifyService.js';
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

async function countSchoolParentDeskUnread(tenantId: number): Promise<number> {
  const unreadRow = await query(
    `SELECT COUNT(*)::int AS c
     FROM parent_messages m
     WHERE m.tenant_id = $1
       AND m.is_deleted = false
       AND (
         m.is_read_by_school = false
         OR EXISTS (
           SELECT 1 FROM message_replies r
           WHERE r.message_id = m.id
             AND r.sender_type = 'parent'
             AND r.is_read = false
             AND r.is_deleted = false
         )
       )`,
    [tenantId]
  );
  return Number(unreadRow.rows[0]?.c ?? 0);
}

async function emitParentDeskNotification(tenantId: number, preview: string) {
  try {
    const unreadCount = await countSchoolParentDeskUnread(tenantId);
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

async function emitParentDeskUpdate(
  tenantId: number,
  payload: { messageId: number; action: string; reply?: Record<string, unknown>; parentAccountId?: number }
) {
  try {
    const { getIO } = await import('../socket.js');
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('parent-desk-update', { tenantId, ...payload, at: Date.now() });
    if (payload.parentAccountId) {
      io.to(`user:${payload.parentAccountId}`).emit('parent-desk-update', { tenantId, ...payload, at: Date.now() });
    }
  } catch {
    // ignore
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
    await emitParentDeskUpdate(req.parent!.tenantId, {
      messageId: Number(result.rows[0].id),
      action: 'created',
      parentAccountId: req.parent!.accountId,
    });
    await notifySchoolStaffOfParentDesk(req.parent!.tenantId, {
      title: 'New Parent Desk message',
      body: String(result.rows[0].message || finalSubject).slice(0, 160),
      url: '/?module=parent-desk',
    }).catch(() => {});
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
       WHERE m.parent_account_id = $1 AND m.tenant_id = $2 AND m.is_deleted = false
         AND r.is_deleted = false
         AND r.sender_type = 'school' AND r.is_read = false`,
      [req.parent!.accountId, req.parent!.tenantId]
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
       WHERE m.parent_account_id = $1 AND m.tenant_id = $2 AND m.is_deleted = false
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
       WHERE m.id = $1 AND m.parent_account_id = $2 AND m.tenant_id = $3 AND m.is_deleted = false`,
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const replies = await query(
      `SELECT id, sender_type, reply_text, attachment_url, is_read, created_at
       FROM message_replies WHERE message_id = $1 AND is_deleted = false ORDER BY created_at ASC`,
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
      'SELECT id, parent_account_id FROM parent_messages WHERE id = $1 AND parent_account_id = $2 AND tenant_id = $3 AND is_deleted = false',
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
    await emitParentDeskNotification(req.parent!.tenantId, replyText.slice(0, 120));
    await emitParentDeskUpdate(req.parent!.tenantId, {
      messageId: id,
      action: 'reply',
      reply: inserted.rows[0],
      parentAccountId: Number(msg.rows[0].parent_account_id),
    });
    await notifySchoolStaffOfParentDesk(req.parent!.tenantId, {
      title: 'Parent replied on Parent Desk',
      body: replyText.slice(0, 160),
      url: '/?module=parent-desk',
    }).catch(() => {});
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
              (CASE WHEN m.is_read_by_school = false THEN 1 ELSE 0 END)::int +
              (SELECT COUNT(*)::int FROM message_replies r WHERE r.message_id = m.id AND r.sender_type = 'parent' AND r.is_read = false AND r.is_deleted = false) AS unread_parent_replies
       FROM parent_messages m
       JOIN parent_portal_accounts p ON p.id = m.parent_account_id
       JOIN students s ON s.id = m.student_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE m.tenant_id = $1 AND m.is_deleted = false
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
    const count = await countSchoolParentDeskUnread(tenantId);
    return res.json({ count });
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
       WHERE m.id = $1 AND m.tenant_id = $2 AND m.is_deleted = false`,
      [id, tenantId]
    );
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' });
    const replies = await query(
      `SELECT id, sender_type, reply_text, attachment_url, is_read, created_at
       FROM message_replies WHERE message_id = $1 AND is_deleted = false ORDER BY created_at ASC`,
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
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
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
    await emitParentDeskUpdate(tenantId, {
      messageId: id,
      action: 'reply',
      reply: inserted.rows[0],
      parentAccountId: Number(msg.rows[0].parent_account_id),
    });
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

// -------- Delete routes (admin paths MUST be registered before /:messageId wildcards) --------

// Delete a reply — school admin side
router.delete('/admin/replies/:replyId', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const replyId = Number(req.params.replyId);
    if (isNaN(replyId)) return res.status(400).json({ error: 'Invalid reply ID' });
    const row = await query(
      `SELECT r.id, r.message_id, m.parent_account_id
       FROM message_replies r
       INNER JOIN parent_messages m ON m.id = r.message_id
       WHERE r.id = $1 AND m.tenant_id = $2 AND m.is_deleted = false AND r.is_deleted = false`,
      [replyId, tenantId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Reply not found' });
    await query(`UPDATE message_replies SET is_deleted = true WHERE id = $1`, [replyId]);
    const messageId = Number(row.rows[0].message_id);
    const parentAccountId = Number(row.rows[0].parent_account_id);
    await emitParentDeskToTenant(tenantId);
    await emitParentDeskUpdate(tenantId, {
      messageId,
      action: 'reply-deleted',
      reply: { id: replyId },
      parentAccountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete reply error:', error);
    return res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// Delete initial parent message only — school admin
router.delete('/admin/:id/initial', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const row = await query(
      `SELECT id, parent_account_id FROM parent_messages
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
      [id, tenantId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Message not found' });
    await query(
      `UPDATE parent_messages
       SET is_initial_deleted = true, message = '', attachment_url = NULL
       WHERE id = $1`,
      [id]
    );
    const parentAccountId = Number(row.rows[0].parent_account_id);
    await emitParentDeskToTenant(tenantId);
    await emitParentDeskUpdate(tenantId, {
      messageId: id,
      action: 'initial-deleted',
      parentAccountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete initial message error:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete entire thread — school admin side
router.delete('/admin/:id', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const row = await query(
      `SELECT id, parent_account_id FROM parent_messages
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
      [id, tenantId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Message not found' });
    await query(`UPDATE parent_messages SET is_deleted = true WHERE id = $1`, [id]);
    await query(`UPDATE message_replies SET is_deleted = true WHERE message_id = $1`, [id]);
    const parentAccountId = Number(row.rows[0].parent_account_id);
    await emitParentDeskToTenant(tenantId);
    await emitParentDeskNotification(tenantId, 'Conversation removed');
    await emitParentDeskUpdate(tenantId, {
      messageId: id,
      action: 'thread-deleted',
      parentAccountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete thread error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Delete a reply — parent side
router.delete('/:messageId/replies/:replyId', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const replyId = Number(req.params.replyId);
    if (isNaN(messageId) || isNaN(replyId)) return res.status(400).json({ error: 'Invalid ID' });
    const thread = await query(
      `SELECT id, parent_account_id FROM parent_messages
       WHERE id = $1 AND parent_account_id = $2 AND tenant_id = $3 AND is_deleted = false`,
      [messageId, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!thread.rows.length) return res.status(404).json({ error: 'Message not found' });
    const updated = await query(
      `UPDATE message_replies SET is_deleted = true
       WHERE id = $1 AND message_id = $2 AND is_deleted = false
       RETURNING id`,
      [replyId, messageId]
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Reply not found' });
    await emitParentDeskToTenant(req.parent!.tenantId);
    await emitParentDeskUpdate(req.parent!.tenantId, {
      messageId,
      action: 'reply-deleted',
      reply: { id: replyId },
      parentAccountId: req.parent!.accountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent delete reply error:', error);
    return res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// Delete initial parent message only — parent side
router.delete('/:id/initial', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const updated = await query(
      `UPDATE parent_messages
       SET is_initial_deleted = true, message = '', attachment_url = NULL
       WHERE id = $1 AND parent_account_id = $2 AND tenant_id = $3 AND is_deleted = false
       RETURNING id`,
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Message not found' });
    await emitParentDeskToTenant(req.parent!.tenantId);
    await emitParentDeskUpdate(req.parent!.tenantId, {
      messageId: id,
      action: 'initial-deleted',
      parentAccountId: req.parent!.accountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent delete initial message error:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete entire thread — parent side
router.delete('/:id', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });
    const updated = await query(
      `UPDATE parent_messages SET is_deleted = true
       WHERE id = $1 AND parent_account_id = $2 AND tenant_id = $3 AND is_deleted = false
       RETURNING id`,
      [id, req.parent!.accountId, req.parent!.tenantId]
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Message not found' });
    await query(`UPDATE message_replies SET is_deleted = true WHERE message_id = $1`, [id]);
    await emitParentDeskToTenant(req.parent!.tenantId);
    await emitParentDeskNotification(req.parent!.tenantId, 'Conversation removed');
    await emitParentDeskUpdate(req.parent!.tenantId, {
      messageId: id,
      action: 'thread-deleted',
      parentAccountId: req.parent!.accountId,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent delete thread error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
