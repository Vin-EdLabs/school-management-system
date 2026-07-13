import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { AuthenticatedSocket, SocketUser } from '../socket.js';
import { query } from '../db/connection.js';
import {
  createMessage,
  getDmConversationIdForChannel,
  getUserChannelIds,
  markChannelRead,
  softDeleteMessage,
  httpError,
} from '../services/chatService.js';

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function normalizeRole(role: string | null | undefined): string {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
}

async function authenticateChatSocket(socket: AuthenticatedSocket): Promise<SocketUser | null> {
  const token = socket.handshake.auth?.token;
  if (!token) return null;
  const decoded = jwt.verify(String(token), process.env.JWT_SECRET || 'secret') as {
    userId?: number;
    role?: string;
  };
  if (decoded.role === 'parent') return null;
  const result = await query(
    `SELECT u.id, u.tenant_id, u.username, u.role,
            COALESCE(t.full_name, u.full_name, u.username) AS full_name
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
     WHERE u.id = $1 AND u.is_active = true`,
    [decoded.userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: Number(row.id),
    tenantId: row.tenant_id != null ? Number(row.tenant_id) : null,
    username: row.username,
    role: normalizeRole(row.role),
    fullName: row.full_name,
  };
}

async function joinChatRooms(socket: AuthenticatedSocket, user: SocketUser) {
  if (user.tenantId) {
    socket.join(`tenant:${user.tenantId}`);
    const channelIds = await getUserChannelIds(user.id, user.tenantId);
    for (const channelId of channelIds) {
      socket.join(`channel:${channelId}`);
      const dmId = await getDmConversationIdForChannel(channelId);
      if (dmId) socket.join(`dm:${dmId}`);
    }
  }
}

export function initChatSocket(io: Server) {
  const chatNs = io.of('/chat');

  chatNs.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const user = await authenticateChatSocket(socket);
      if (!user) return next(new Error('Authentication error'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  chatNs.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    void joinChatRooms(socket, user);

    socket.on('send_message', async (payload: {
      channel_id: number;
      message?: string;
      image_url?: string;
      image_thumbnail_url?: string;
      temp_id?: string;
    }) => {
      try {
        if (!user.tenantId) throw httpError(403, 'Tenant required');
        const created = await createMessage({
          channelId: Number(payload.channel_id),
          tenantId: user.tenantId,
          senderId: user.id,
          senderRole: user.role,
          message: payload.message,
          imageUrl: payload.image_url,
          imageThumbnailUrl: payload.image_thumbnail_url,
        });

        chatNs.to(`channel:${payload.channel_id}`).emit('new_message', created);
        if (payload.temp_id) {
          socket.emit('message_sent_ack', { temp_id: payload.temp_id, real_id: created.id });
        }
        if (user.tenantId) {
          chatNs.to(`tenant:${user.tenantId}`).emit('chat_unread_changed', { tenantId: user.tenantId });
        }
      } catch (err) {
        socket.emit('message_send_error', {
          temp_id: payload.temp_id,
          error: err instanceof Error ? err.message : 'Send failed',
        });
      }
    });

    socket.on('delete_message', async (payload: { message_id: number }) => {
      try {
        const result = await softDeleteMessage(Number(payload.message_id), user.id);
        chatNs.to(`channel:${result.channel_id}`).emit('message_deleted', {
          message_id: result.id,
          channel_id: result.channel_id,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('mark_read', async (payload: { channel_id: number }) => {
      try {
        await markChannelRead(Number(payload.channel_id), user.id);
        if (user.tenantId) {
          chatNs.to(`tenant:${user.tenantId}`).emit('chat_unread_changed', { tenantId: user.tenantId });
        }
      } catch {
        /* ignore */
      }
    });

    socket.on('typing_start', (payload: { channel_id: number }) => {
      const key = `${payload.channel_id}:${user.id}`;
      if (typingTimers.has(key)) clearTimeout(typingTimers.get(key)!);
      socket.to(`channel:${payload.channel_id}`).emit('user_typing', {
        channel_id: payload.channel_id,
        user_id: user.id,
        name: user.fullName || user.username,
      });
      typingTimers.set(
        key,
        setTimeout(() => {
          socket.to(`channel:${payload.channel_id}`).emit('user_stopped_typing', {
            channel_id: payload.channel_id,
            user_id: user.id,
          });
          typingTimers.delete(key);
        }, 3000)
      );
    });

    socket.on('typing_stop', (payload: { channel_id: number }) => {
      const key = `${payload.channel_id}:${user.id}`;
      if (typingTimers.has(key)) clearTimeout(typingTimers.get(key)!);
      typingTimers.delete(key);
      socket.to(`channel:${payload.channel_id}`).emit('user_stopped_typing', {
        channel_id: payload.channel_id,
        user_id: user.id,
      });
    });

    socket.on('join_channel', async (payload: { channel_id: number }) => {
      socket.join(`channel:${payload.channel_id}`);
      const dmId = await getDmConversationIdForChannel(Number(payload.channel_id));
      if (dmId) socket.join(`dm:${dmId}`);
    });
  });

  return chatNs;
}

export async function tryAttachRedisAdapter(io: Server): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { createClient } = await import('redis');
    const pub = createClient({ url: redisUrl });
    const sub = pub.duplicate();
    await pub.connect();
    await sub.connect();
    io.adapter(createAdapter(pub, sub));
    console.log('[chat] Socket.io Redis adapter attached');
  } catch (err) {
    console.warn('[chat] Redis adapter unavailable:', (err as Error).message);
  }
}
