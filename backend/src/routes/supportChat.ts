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

const uploadsDir = path.join(__dirname, '../../uploads/support');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'jpg';
    cb(null, `support-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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

    await query(
      `INSERT INTO support_messages (tenant_id, user_id, sender_role, sender_username, tenant_name, message, is_from_superadmin, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, user.id, user.role, user.username, tenantName, message || '', isSuperAdmin, isSuperAdmin ? new Date() : null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Support chat post error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Upload image and send as message
router.post('/upload-image', authenticate, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const targetTenantId = req.body.tenantId != null ? parseInt(String(req.body.tenantId)) : null;

    const isSuperAdmin = user.role === 'super-admin';
    let tenantId: number | null;
    let tenantName: string | null = null;
    if (isSuperAdmin) {
      tenantId = targetTenantId;
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

    const imageUrl = `/uploads/support/${req.file.filename}`;
    await query(
      `INSERT INTO support_messages (tenant_id, user_id, sender_role, sender_username, tenant_name, message, image_url, is_from_superadmin, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, user.id, user.role, user.username, tenantName, '', imageUrl, isSuperAdmin, isSuperAdmin ? new Date() : null]
    );
    res.json({ success: true, imageUrl });
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
