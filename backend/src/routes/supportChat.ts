import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

async function emitSupportNotification(tenantId: number, preview: string) {
  try {
    const unreadRow = await query(
      `SELECT COUNT(*)::int AS c FROM support_messages WHERE tenant_id = $1 AND is_from_superadmin = true AND read_at IS NULL`,
      [tenantId]
    );
    const unreadCount = Number(unreadRow.rows[0]?.c ?? 0);
    const { getIO } = await import('../socket.js');
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('new-parent-message', {
      type: 'support-chat',
      count: unreadCount,
      preview: preview.slice(0, 120),
      timestamp: Date.now(),
    });
  } catch (socketErr) {
    console.error('Support notification emit error:', socketErr);
  }
}

const uploadsDir = path.join(__dirname, '../../uploads/support');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } }); // client compresses; server accepts up to 8MB before write

// Get conversations list (super-admin only) - all schools with last message and unread count
router.get('/conversations', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'super-admin') return res.status(403).json({ error: 'Super-admin only' });
    const result = await query(
      `WITH last_msg AS (
        SELECT DISTINCT ON (tenant_id) tenant_id,
          message, image_url, sender_username, sender_role, is_from_superadmin, created_at
        FROM support_messages
        WHERE tenant_id IS NOT NULL
        ORDER BY tenant_id, created_at DESC
      ),
      unread AS (
        SELECT tenant_id, COUNT(*) as cnt
        FROM support_messages
        WHERE is_from_superadmin = false AND read_at IS NULL
        GROUP BY tenant_id
      )
      SELECT t.id as tenant_id, t.name as tenant_name, t.logo_url,
        lm.message as last_message, lm.image_url as last_image_url,
        lm.sender_username, lm.sender_role, lm.is_from_superadmin, lm.created_at as last_message_at,
        COALESCE(u.cnt, 0)::int as unread_count
      FROM tenants t
      LEFT JOIN last_msg lm ON lm.tenant_id = t.id
      LEFT JOIN unread u ON u.tenant_id = t.id
      WHERE t.is_active = true
      ORDER BY lm.created_at DESC NULLS LAST, t.name ASC`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Support conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Unread badge: super-admin = unread school messages; school admin/finance = unread super-admin replies
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (user.role === 'super-admin') {
      const r = await query(
        `SELECT COUNT(*)::int AS c FROM support_messages WHERE is_from_superadmin = false AND read_at IS NULL`
      );
      return res.json({ count: Number(r.rows[0]?.c ?? 0) });
    }
    if (!user.tenantId || (user.role !== 'administrator' && user.role !== 'finance')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const r = await query(
      `SELECT COUNT(*)::int AS c FROM support_messages WHERE tenant_id = $1 AND is_from_superadmin = true AND read_at IS NULL`,
      [user.tenantId]
    );
    return res.json({ count: Number(r.rows[0]?.c ?? 0) });
  } catch (error) {
    console.error('Support unread-count error:', error);
    res.status(500).json({ error: 'Failed to read unread count' });
  }
});

// School marks super-admin thread messages as read (opens support chat)
router.post('/mark-read-by-school', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.tenantId || (user.role !== 'administrator' && user.role !== 'finance')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await query(
      `UPDATE support_messages SET read_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND is_from_superadmin = true AND read_at IS NULL`,
      [user.tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('mark-read-by-school error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get messages - super-admin filters by tenantId, tenant users get their thread
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const limit = Math.min(parseInt(String(req.query.limit)) || 100, 200);
    const tenantIdParam = req.query.tenantId ? parseInt(String(req.query.tenantId)) : null;

    if (user.role === 'super-admin') {
      const params: any[] = [limit];
      const tenantFilter = tenantIdParam ? ' AND m.tenant_id = $2' : '';
      if (tenantIdParam) params.push(tenantIdParam);

      const result = await query(
        `SELECT m.*, COALESCE(t.name, m.tenant_name) as tenant_name
         FROM support_messages m
         LEFT JOIN tenants t ON m.tenant_id = t.id
         WHERE 1=1${tenantFilter}
         ORDER BY m.created_at ASC
         LIMIT $1`,
        params
      );
      return res.json(result.rows);
    }

    if (!user.tenantId) return res.status(403).json({ error: 'No school context' });
    if (user.role !== 'administrator' && user.role !== 'finance') {
      return res.status(403).json({ error: 'Only administrators and finance can use support chat' });
    }

    const result = await query(
      `SELECT m.*, COALESCE(t.name, m.tenant_name) as tenant_name
       FROM support_messages m
       LEFT JOIN tenants t ON m.tenant_id = t.id
       WHERE m.tenant_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [user.tenantId, limit]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Support chat get error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { message, tenantId: targetTenantId } = req.body;

    const isSuperAdmin = user.role === 'super-admin';
    let tenantId: number | null;
    let tenantName: string | null = null;

    if (isSuperAdmin) {
      tenantId = targetTenantId != null ? parseInt(String(targetTenantId)) : null;
      if (tenantId) {
        const t = await query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
        tenantName = t.rows[0]?.name || null;
      }
    } else {
      tenantId = user.tenantId ?? null;
      if (tenantId) {
        const t = await query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
        tenantName = t.rows[0]?.name || null;
      }
    }

    const insertResult = await query(
      `INSERT INTO support_messages (tenant_id, user_id, sender_role, sender_username, tenant_name, message, is_from_superadmin, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, user.id, user.role, user.username, tenantName, message || '', isSuperAdmin, null]
    );

    const newMessage = insertResult.rows[0];

    // Emit via socket
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      if (tenantId) {
        io.to(`tenant:${tenantId}`).emit('new-support-message', newMessage);
        await emitSupportNotification(tenantId, String(newMessage.message || 'New support message'));
      }
      io.emit('new-support-message', newMessage);
      if (tenantId) {
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'support-chat',
          action: 'created',
          at: Date.now(),
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
    }

    res.json(newMessage);
  } catch (error) {
    console.error('Support chat post error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function assertSupportChatSender(user: AuthRequest['user']) {
  if (!user) return 'Unauthorized';
  if (user.role === 'super-admin') return null;
  if (!user.tenantId) return 'No school context';
  if (user.role !== 'administrator' && user.role !== 'finance') {
    return 'Only administrators and finance can use support chat';
  }
  return null;
}

function handleImageUpload(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  upload.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Image must be under 8MB. Try a smaller photo.' });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    if (err) return next(err);
    return next();
  });
}

// Upload image and send as message — optional caption in body field "message"
router.post('/upload-image', authenticate, handleImageUpload, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const accessError = assertSupportChatSender(user);
    if (accessError) return res.status(403).json({ error: accessError });
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    if (!ALLOWED_IMAGE.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, GIF, or WebP images are allowed' });
    }
    const targetTenantId = req.body.tenantId != null ? parseInt(String(req.body.tenantId)) : null;
    const caption =
      typeof req.body.message === 'string'
        ? req.body.message.trim().slice(0, 2000)
        : typeof req.body.caption === 'string'
          ? req.body.caption.trim().slice(0, 2000)
          : '';

    const isSuperAdmin = user.role === 'super-admin';
    let tenantId: number | null;
    let tenantName: string | null = null;
    if (isSuperAdmin) {
      tenantId = targetTenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Select a school before uploading an image' });
      }
      if (tenantId) {
        const t = await query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
        tenantName = t.rows[0]?.name || null;
      }
    } else {
      tenantId = user.tenantId ?? null;
      if (tenantId) {
        const t = await query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
        tenantName = t.rows[0]?.name || null;
      }
    }

    const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const insertResult = await query(
      `INSERT INTO support_messages (tenant_id, user_id, sender_role, sender_username, tenant_name, message, image_url, is_from_superadmin, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, user.id, user.role, user.username, tenantName, caption, imageUrl, isSuperAdmin, null]
    );

    const newMessage = insertResult.rows[0];

    // Emit via socket
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      if (tenantId) {
        io.to(`tenant:${tenantId}`).emit('new-support-message', newMessage);
        await emitSupportNotification(tenantId, String(newMessage.message || 'New support message'));
      }
      io.emit('new-support-message', newMessage);
      if (tenantId) {
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'support-chat',
          action: 'created',
          at: Date.now(),
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
    }

    res.json(newMessage);
  } catch (error) {
    console.error('Support chat image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Mark as read (super-admin) - by tenant or by message ids
router.post('/mark-read', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'super-admin') return res.status(403).json({ error: 'Super-admin only' });
    const { ids, tenantId } = req.body;
    if (tenantId != null) {
      await query(
        `UPDATE support_messages SET read_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND is_from_superadmin = false AND read_at IS NULL`,
        [tenantId]
      );
    } else if (Array.isArray(ids) && ids.length > 0) {
      await query(
        `UPDATE support_messages SET read_at = CURRENT_TIMESTAMP WHERE id = ANY($1::int[]) AND is_from_superadmin = false`,
        [ids]
      );
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
