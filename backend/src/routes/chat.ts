import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import {
  authenticate,
  requireRole,
  requireTenant,
  type AuthRequest,
} from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  canPostToAnnouncements,
  createMessage,
  getMessageById,
  getChannelStats,
  getOrCreateDm,
  listChannelMessages,
  listDmStaff,
  listSuperAdminSchoolGenerals,
  listSuperAdminSchoolMessages,
  listUserChannels,
  markChannelRead,
  setChannelNotificationsMuted,
  softDeleteMessage,
  superAdminBroadcast,
  superAdminPostToSchoolGeneral,
  httpError,
} from '../services/chatService.js';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

function tenantIdOf(req: AuthRequest): number {
  const id = req.user?.tenantId;
  if (id == null) throw httpError(403, 'Tenant required');
  return Number(id);
}

function handleError(res: express.Response, err: unknown) {
  const e = err as Error & { status?: number };
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  res.status(status).json({ error: e.message || 'Request failed' });
}

const uploadRoot = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Invalid image type'));
  },
});

router.use(authenticate);

router.get('/channels', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const { ensureTenantChatChannels, syncUserChatMemberships } = await import('../services/chatService.js');
    await ensureTenantChatChannels(tenantId);
    await syncUserChatMemberships(tenantId, req.user!.id, req.user!.role);
    const data = await listUserChannels(req.user!.id, tenantId);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/channels/:id/stats', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.id);
    const stats = await getChannelStats(channelId, req.user!.id);
    res.json(stats);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/channels/:id/messages', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const channelId = Number(req.params.id);
    const beforeId = req.query.before_id ? Number(req.query.before_id) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const data = await listChannelMessages(channelId, req.user!.id, tenantId, { beforeId, limit });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/channels/:id/messages', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const channelId = Number(req.params.id);
    const { message, image_url, image_thumbnail_url } = req.body || {};

    const created = await createMessage({
      channelId,
      tenantId,
      senderId: req.user!.id,
      senderRole: req.user!.role,
      message,
      imageUrl: image_url,
      imageThumbnailUrl: image_thumbnail_url,
    });

    try {
      const io = getIO();
      io.of('/chat').to(`channel:${channelId}`).emit('new_message', created);
      io.of('/chat').to(`tenant:${tenantId}`).emit('chat_unread_changed', { tenantId });
    } catch {
      /* non-fatal */
    }

    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/messages/:id', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const result = await softDeleteMessage(Number(req.params.id), req.user!.id);
    try {
      const io = getIO();
      io.of('/chat')
        .to(`channel:${result.channel_id}`)
        .emit('message_deleted', { message_id: result.id, channel_id: result.channel_id });
    } catch {
      /* non-fatal */
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/dm', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const targetUserId = Number(req.body?.target_user_id);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'target_user_id required' });
    }
    const dm = await getOrCreateDm(tenantId, req.user!.id, targetUserId);
    res.json(dm);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/staff', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const search = String(req.query.search || '');
    const items = await listDmStaff(tenantId, req.user!.id, search);
    res.json({ items });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/channels/:id/read', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.id);
    await markChannelRead(channelId, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/channels/:id/mute', requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.id);
    const muted = !!req.body?.muted;
    await setChannelNotificationsMuted(channelId, req.user!.id, muted);
    res.json({ ok: true, muted });
  } catch (err) {
    handleError(res, err);
  }
});

router.post(
  '/super-admin/broadcast',
  requireRole('super-admin'),
  async (req: AuthRequest, res) => {
    try {
      const { tenant_id, message } = req.body || {};
      const posted = await superAdminBroadcast({
        message: String(message || ''),
        tenantId: tenant_id != null ? Number(tenant_id) : null,
      });

      try {
        const io = getIO();
        for (const p of posted) {
          const full = await getMessageById(p.message_id, 0);
          io.of('/chat').to(`channel:${p.channel_id}`).emit('new_message', full);
          io.of('/chat').to(`tenant:${p.tenant_id}`).emit('chat_unread_changed', { tenantId: p.tenant_id });
        }
      } catch {
        /* non-fatal */
      }

      res.status(201).json({ posted: posted.length, items: posted });
    } catch (err) {
      handleError(res, err);
    }
  }
);

router.get('/super-admin/schools', requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const schools = await listSuperAdminSchoolGenerals();
    res.json({ schools });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/super-admin/schools/:tenantId/messages', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const beforeId = req.query.before_id ? Number(req.query.before_id) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const data = await listSuperAdminSchoolMessages(tenantId, { beforeId, limit });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/super-admin/schools/:tenantId/messages', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const { message, image_url, image_thumbnail_url } = req.body || {};
    const created = await superAdminPostToSchoolGeneral(tenantId, {
      message,
      imageUrl: image_url,
      imageThumbnailUrl: image_thumbnail_url,
    });

    try {
      const io = getIO();
      io.of('/chat').to(`channel:${created.channel_id}`).emit('new_message', created);
      io.of('/chat').to(`tenant:${tenantId}`).emit('chat_unread_changed', { tenantId });
    } catch {
      /* non-fatal */
    }

    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.post(
  '/super-admin/upload-image',
  requireRole('super-admin'),
  upload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image provided' });
      const tenantId = Number(req.body?.tenant_id);
      if (!Number.isFinite(tenantId)) return res.status(400).json({ error: 'tenant_id required' });

      const tenantDir = path.join(uploadRoot, String(tenantId));
      if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });

      const id = randomUUID();
      const fullName = `${id}_full.jpg`;
      const thumbName = `${id}_thumb.jpg`;
      const fullPath = path.join(tenantDir, fullName);
      const thumbPath = path.join(tenantDir, thumbName);

      const pipeline = sharp(req.file.buffer).rotate();
      if (req.file.mimetype === 'image/gif') {
        await fs.promises.writeFile(fullPath, req.file.buffer);
        await sharp(req.file.buffer, { animated: false })
          .resize({ width: 300, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } else {
        await pipeline.clone().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(fullPath);
        await pipeline.clone().resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(thumbPath);
      }

      const image_url = `/uploads/chat/${tenantId}/${fullName}`;
      const image_thumbnail_url = `/uploads/chat/${tenantId}/${thumbName}`;
      res.json({ image_url, image_thumbnail_url });
    } catch (err) {
      console.error('Super admin chat image upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

router.post('/upload-image', requireTenant, setTenantContext, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const tenantId = tenantIdOf(req);
    const tenantDir = path.join(uploadRoot, String(tenantId));
    if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });

    const id = randomUUID();
    const fullName = `${id}_full.jpg`;
    const thumbName = `${id}_thumb.jpg`;
    const fullPath = path.join(tenantDir, fullName);
    const thumbPath = path.join(tenantDir, thumbName);

    const pipeline = sharp(req.file.buffer).rotate();
    if (req.file.mimetype === 'image/gif') {
      await fs.promises.writeFile(fullPath, req.file.buffer);
      await sharp(req.file.buffer, { animated: false })
        .resize({ width: 300, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
    } else {
      await pipeline.clone().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(fullPath);
      await pipeline.clone().resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(thumbPath);
    }

    const image_url = `/uploads/chat/${tenantId}/${fullName}`;
    const image_thumbnail_url = `/uploads/chat/${tenantId}/${thumbName}`;
    res.json({ image_url, image_thumbnail_url });
  } catch (err) {
    console.error('Chat image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export { canPostToAnnouncements };

export default router;
