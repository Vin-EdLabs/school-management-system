import { query } from '../db/connection.js';

export type ChatChannelType =
  | 'general'
  | 'teachers'
  | 'non_teaching'
  | 'announcements'
  | 'dm';

const TEACHING_ROLES = new Set(['teacher', 'headmaster']);
const ANNOUNCEMENT_POST_ROLES = new Set(['administrator', 'headmaster', 'super-admin']);

export function canPostToAnnouncements(role: string): boolean {
  return ANNOUNCEMENT_POST_ROLES.has(String(role || '').toLowerCase());
}

export function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function normalizeRole(role: string | null | undefined): string {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
}

function avatarInitials(name: string | null | undefined): string {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function channelSortOrder(type: ChatChannelType): number {
  switch (type) {
    case 'announcements':
      return 0;
    case 'general':
      return 1;
    case 'teachers':
      return 2;
    case 'dm':
      return 3;
    default:
      return 9;
  }
}

function channelsForRole(role: string): ChatChannelType[] {
  const r = normalizeRole(role);
  const base: ChatChannelType[] = ['general', 'announcements'];
  if (TEACHING_ROLES.has(r)) base.push('teachers');
  if (r === 'super-admin') return ['general', 'announcements', 'teachers'];
  return base;
}

const DEFAULT_CHANNELS: Array<{ type: ChatChannelType; name: string; description: string }> = [
  { type: 'general', name: 'General', description: 'School-wide conversation for all staff' },
  { type: 'teachers', name: 'Teachers', description: 'Teaching staff channel' },
  { type: 'announcements', name: 'Announcements', description: 'Official announcements from admins' },
];

export async function ensureTenantChatChannels(tenantId: number): Promise<void> {
  for (const ch of DEFAULT_CHANNELS) {
    const existing = await query(
      `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = $2 LIMIT 1`,
      [tenantId, ch.type]
    );
    if (existing.rows.length > 0) continue;
    await query(
      `INSERT INTO chat_channels (tenant_id, name, channel_type, description)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, ch.name, ch.type, ch.description]
    );
  }
}

/** Create default channels then backfill memberships for every active user (tenant setup only). */
export async function bootstrapTenantChat(tenantId: number): Promise<void> {
  await ensureTenantChatChannels(tenantId);
  await syncTenantChannelMemberships(tenantId);
}

export async function syncUserChatMemberships(tenantId: number, userId: number, role: string): Promise<void> {
  await ensureTenantChatChannels(tenantId);
  const types = channelsForRole(role);
  for (const type of types) {
    const ch = await query(
      `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = $2 LIMIT 1`,
      [tenantId, type]
    );
    const channelId = ch.rows[0]?.id;
    if (!channelId) continue;
    await query(
      `INSERT INTO chat_channel_members (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, userId]
    );
  }
}

export async function syncTenantChannelMemberships(tenantId: number): Promise<void> {
  await ensureTenantChatChannels(tenantId);
  const users = await query(
    `SELECT id, role FROM users WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  for (const row of users.rows) {
    const types = channelsForRole(String(row.role));
    for (const type of types) {
      const ch = await query(
        `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = $2 LIMIT 1`,
        [tenantId, type]
      );
      const channelId = ch.rows[0]?.id;
      if (!channelId) continue;
      await query(
        `INSERT INTO chat_channel_members (channel_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channelId, Number(row.id)]
      );
    }
  }
}

async function assertChannelMember(channelId: number, userId: number): Promise<void> {
  const r = await query(
    `SELECT 1 FROM chat_channel_members WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );
  if (r.rows.length === 0) throw httpError(403, 'Not a member of this channel');
}

export async function getChannelStats(channelId: number, userId: number) {
  await assertChannelMember(channelId, userId);
  const channel = await getChannelMeta(channelId);
  const tenantId = channel.tenant_id;

  let memberCount = 0;
  if (channel.channel_type === 'dm') {
    const memberRes = await query(
      `SELECT COUNT(*)::int AS member_count FROM chat_channel_members WHERE channel_id = $1`,
      [channelId]
    );
    memberCount = Number(memberRes.rows[0]?.member_count ?? 0);
  } else if (tenantId != null) {
    if (channel.channel_type === 'teachers') {
      const r = await query(
        `SELECT COUNT(*)::int AS c FROM users
         WHERE tenant_id = $1 AND is_active = true
           AND LOWER(TRIM(role)) IN ('teacher', 'headmaster')`,
        [tenantId]
      );
      memberCount = Number(r.rows[0]?.c ?? 0);
    } else {
      const r = await query(
        `SELECT COUNT(*)::int AS c FROM users
         WHERE tenant_id = $1 AND is_active = true
           AND LOWER(TRIM(role)) NOT IN ('parent', 'super-admin', 'superadmin')`,
        [tenantId]
      );
      memberCount = Number(r.rows[0]?.c ?? 0);
    }
  }

  let onlineCount = 0;
  try {
    const { getIO } = await import('../socket.js');
    const room = getIO().of('/chat').adapter.rooms.get(`channel:${channelId}`);
    onlineCount = room?.size ?? 0;
  } catch {
    onlineCount = 0;
  }

  return {
    member_count: memberCount,
    online_count: onlineCount,
  };
}

async function getChannelMeta(channelId: number) {
  const r = await query(
    `SELECT c.*, dc.id AS dm_id
     FROM chat_channels c
     LEFT JOIN dm_conversations dc ON dc.channel_id = c.id
     WHERE c.id = $1`,
    [channelId]
  );
  if (r.rows.length === 0) throw httpError(404, 'Channel not found');
  return r.rows[0] as {
    id: number;
    tenant_id: number | null;
    name: string;
    channel_type: ChatChannelType;
    description: string | null;
    dm_id: number | null;
  };
}

function formatSenderRow(row: {
  sender_id: number | null;
  sender_label: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
}) {
  if (row.sender_id == null) {
    return { id: null, name: row.sender_label || 'ScholarNerve Team', role: 'platform' as const };
  }
  return {
    id: row.sender_id,
    name: row.sender_name || 'Staff',
    role: normalizeRole(row.sender_role || 'staff'),
    avatar_initials: avatarInitials(row.sender_name),
  };
}

export async function listUserChannels(userId: number, tenantId: number) {
  const result = await query(
    `SELECT c.id, c.name, c.channel_type, c.description, c.tenant_id,
            m.last_read_at,
            COALESCE(m.notifications_muted, false) AS notifications_muted,
            dc.id AS dm_conversation_id,
            dc.participant_one, dc.participant_two,
            (
              SELECT COUNT(*)::int FROM chat_messages cm
              WHERE cm.channel_id = c.id AND cm.is_deleted = false
                AND (m.last_read_at IS NULL OR cm.created_at > m.last_read_at)
                AND (cm.sender_id IS NULL OR cm.sender_id <> $1)
            ) AS unread_count,
            (
              SELECT row_to_json(lm) FROM (
                SELECT cm.message, cm.image_url, cm.created_at,
                       COALESCE(cm.sender_label,
                         COALESCE(u.full_name, u.username, 'Staff')) AS sender_name,
                       cm.sender_id
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.sender_id
                WHERE cm.channel_id = c.id AND cm.is_deleted = false
                ORDER BY cm.created_at DESC, cm.id DESC
                LIMIT 1
              ) lm
            ) AS last_message,
            CASE WHEN c.channel_type = 'dm' THEN (
              SELECT COALESCE(os.full_name, t.full_name, u.full_name, u.username)
              FROM users u
              LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
              LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
              WHERE u.tenant_id = $2
                AND u.id = CASE
                  WHEN dc.participant_one = $1 THEN dc.participant_two
                  ELSE dc.participant_one
                END
            ) END AS dm_peer_name,
            CASE WHEN c.channel_type = 'dm' THEN (
              SELECT u.role FROM users u
              WHERE u.tenant_id = $2
                AND u.id = CASE
                  WHEN dc.participant_one = $1 THEN dc.participant_two
                  ELSE dc.participant_one
                END
            ) END AS dm_peer_role
     FROM chat_channel_members m
     JOIN chat_channels c ON c.id = m.channel_id
     LEFT JOIN dm_conversations dc ON dc.channel_id = c.id
     WHERE m.user_id = $1
       AND (c.tenant_id = $2 OR (c.tenant_id IS NULL AND c.channel_type = 'general'))
     ORDER BY c.channel_type, c.name`,
    [userId, tenantId]
  );

  const channels = result.rows
    .filter((row) => row.channel_type !== 'non_teaching')
    .map((row) => {
    const lm = row.last_message as {
      message?: string | null;
      image_url?: string | null;
      created_at?: string;
      sender_name?: string;
      sender_id?: number | null;
    } | null;
    const isDm = row.channel_type === 'dm';
    return {
      id: Number(row.id),
      name: isDm ? row.dm_peer_name || row.name || 'Direct Message' : row.name || 'Channel',
      channel_type: row.channel_type as ChatChannelType,
      description: row.description,
      unread_count: Number(row.unread_count || 0),
      notifications_muted: !!row.notifications_muted,
      dm_conversation_id: row.dm_conversation_id ? Number(row.dm_conversation_id) : null,
      dm_peer: isDm
        ? {
            name: row.dm_peer_name || 'Direct Message',
            role: normalizeRole(row.dm_peer_role),
            avatar_initials: avatarInitials(row.dm_peer_name),
          }
        : null,
      last_message: lm
        ? {
            sender_name: lm.sender_id == null ? 'ScholarNerve Team' : lm.sender_name || 'Staff',
            sender_id: lm.sender_id,
            message: lm.message,
            image_url: lm.image_url,
            created_at: lm.created_at,
            is_platform: lm.sender_id == null,
          }
        : null,
    };
  });

  channels.sort((a, b) => {
    const oa = channelSortOrder(a.channel_type);
    const ob = channelSortOrder(b.channel_type);
    if (oa !== ob) return oa - ob;
    const ta = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
    const tb = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
    return tb - ta;
  });

  const totalUnread = channels.reduce((s, c) => s + c.unread_count, 0);
  return { channels, total_unread: totalUnread };
}

function mapMessageRow(
  row: Record<string, unknown>,
  viewerUserId: number,
  superAdminView?: boolean
) {
  const senderId = row.sender_id as number | null;
  const isMine = superAdminView
    ? senderId == null
    : senderId != null && Number(senderId) === viewerUserId;

  return {
    id: Number(row.id),
    channel_id: Number(row.channel_id),
    message: row.is_deleted ? null : (row.message as string | null),
    image_url: row.is_deleted ? null : (row.image_url as string | null),
    image_thumbnail_url: row.is_deleted ? null : (row.image_thumbnail_url as string | null),
    created_at: row.created_at as string,
    is_deleted: !!row.is_deleted,
    is_mine: isMine,
    sender: row.is_deleted
      ? null
      : formatSenderRow({
          sender_id: senderId,
          sender_label: row.sender_label as string | null,
          sender_name: row.sender_name as string | null,
          sender_role: row.sender_role as string | null,
        }),
  };
}

export async function listChannelMessages(
  channelId: number,
  userId: number,
  tenantId: number,
  opts: { beforeId?: number; limit?: number; superAdminView?: boolean } = {}
) {
  const channel = await getChannelMeta(channelId);
  if (channel.tenant_id != null && channel.tenant_id !== tenantId) {
    throw httpError(403, 'Channel not in your school');
  }
  if (!opts.superAdminView) {
    await assertChannelMember(channelId, userId);
  } else if (channel.channel_type !== 'general') {
    throw httpError(403, 'Super admin can only read General channels');
  }

  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
  const params: unknown[] = [channelId];
  let cursorSql = '';
  if (opts.beforeId) {
    params.push(opts.beforeId);
    cursorSql = `AND cm.id < $${params.length}`;
  }
  params.push(limit);

  const result = await query(
    `SELECT cm.*,
            COALESCE(t.full_name, os.full_name, u.username) AS sender_name,
            u.role AS sender_role
     FROM chat_messages cm
     LEFT JOIN users u ON u.id = cm.sender_id
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
     WHERE cm.channel_id = $1 ${cursorSql}
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT $${params.length}`,
    params
  );

  const messages = result.rows.reverse().map((row) => mapMessageRow(row, userId, opts.superAdminView));

  return { messages, channel_type: channel.channel_type };
}

export async function listSuperAdminSchoolGenerals() {
  const result = await query(
    `SELECT t.id AS tenant_id,
            t.name AS tenant_name,
            t.logo_url,
            gc.id AS channel_id,
            (
              SELECT row_to_json(lm) FROM (
                SELECT cm.message, cm.image_url, cm.created_at,
                       COALESCE(cm.sender_label, COALESCE(u.full_name, u.username, 'Staff')) AS sender_name,
                       cm.sender_id
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.sender_id
                WHERE cm.channel_id = gc.id AND cm.is_deleted = false
                ORDER BY cm.created_at DESC, cm.id DESC
                LIMIT 1
              ) lm
            ) AS last_message,
            (
              SELECT COUNT(*)::int FROM chat_messages cm
              WHERE cm.channel_id = gc.id
                AND cm.is_deleted = false
                AND cm.sender_id IS NOT NULL
                AND cm.created_at > COALESCE(
                  (SELECT MAX(created_at) FROM chat_messages
                   WHERE channel_id = gc.id AND sender_id IS NULL AND is_deleted = false),
                  '1970-01-01'::timestamptz
                )
            ) AS unread_count
     FROM tenants t
     LEFT JOIN chat_channels gc ON gc.tenant_id = t.id AND gc.channel_type = 'general'
     WHERE t.is_active = true
     ORDER BY (
       SELECT MAX(created_at) FROM chat_messages WHERE channel_id = gc.id AND is_deleted = false
     ) DESC NULLS LAST, t.name ASC`
  );

  return result.rows.map((row) => {
    const lm = row.last_message as {
      message?: string | null;
      image_url?: string | null;
      created_at?: string;
      sender_name?: string;
      sender_id?: number | null;
    } | null;
    return {
      tenant_id: Number(row.tenant_id),
      tenant_name: row.tenant_name as string,
      logo_url: row.logo_url as string | null,
      channel_id: row.channel_id ? Number(row.channel_id) : null,
      unread_count: Number(row.unread_count || 0),
      last_message: lm
        ? {
            sender_name: lm.sender_id == null ? 'ScholarNerve Team' : lm.sender_name || 'Staff',
            sender_id: lm.sender_id,
            message: lm.message,
            image_url: lm.image_url,
            created_at: lm.created_at,
            is_platform: lm.sender_id == null,
          }
        : null,
    };
  });
}

export async function listSuperAdminSchoolMessages(
  tenantId: number,
  opts: { beforeId?: number; limit?: number } = {}
) {
  await ensureTenantChatChannels(tenantId);
  const ch = await query(
    `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = 'general' LIMIT 1`,
    [tenantId]
  );
  const channelId = Number(ch.rows[0]?.id);
  if (!channelId) throw httpError(404, 'General channel not found');
  return listChannelMessages(channelId, 0, tenantId, { ...opts, superAdminView: true });
}

export async function superAdminPostToSchoolGeneral(
  tenantId: number,
  input: { message?: string | null; imageUrl?: string | null; imageThumbnailUrl?: string | null }
) {
  await ensureTenantChatChannels(tenantId);
  const ch = await query(
    `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = 'general' LIMIT 1`,
    [tenantId]
  );
  const channelId = Number(ch.rows[0]?.id);
  if (!channelId) throw httpError(404, 'General channel not found');

  return createMessage({
    channelId,
    tenantId,
    senderId: null,
    senderLabel: 'ScholarNerve Team',
    senderRole: 'super-admin',
    message: input.message,
    imageUrl: input.imageUrl,
    imageThumbnailUrl: input.imageThumbnailUrl,
    viewerSuperAdmin: true,
  });
}

export async function createMessage(input: {
  channelId: number;
  tenantId: number;
  senderId: number | null;
  senderLabel?: string | null;
  senderRole: string;
  message?: string | null;
  imageUrl?: string | null;
  imageThumbnailUrl?: string | null;
  viewerSuperAdmin?: boolean;
}) {
  const channel = await getChannelMeta(input.channelId);
  if (channel.tenant_id != null && channel.tenant_id !== input.tenantId) {
    throw httpError(403, 'Channel not in your school');
  }

  const text = (input.message || '').trim();
  const hasImage = !!(input.imageUrl && input.imageUrl.trim());
  if (!text && !hasImage) throw httpError(400, 'Message or image required');

  if (channel.channel_type === 'announcements' && !canPostToAnnouncements(input.senderRole)) {
    throw httpError(403, 'Only admins can post in Announcements');
  }

  if (input.senderId != null) {
    await assertChannelMember(input.channelId, input.senderId);
  }

  const insert = await query(
    `INSERT INTO chat_messages
       (channel_id, tenant_id, sender_id, sender_label, message, image_url, image_thumbnail_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [
      input.channelId,
      input.tenantId,
      input.senderId,
      input.senderLabel || null,
      text || null,
      input.imageUrl || null,
      input.imageThumbnailUrl || null,
    ]
  );

  const messageId = Number(insert.rows[0].id);
  const created = await getMessageById(messageId, input.senderId ?? 0, { superAdminView: !!input.viewerSuperAdmin });
  void notifyChatMessageRecipients({
    channelId: input.channelId,
    tenantId: input.tenantId,
    messageId,
    senderId: input.senderId,
    senderLabel: input.senderLabel,
    messageText: text || null,
    hasImage,
  }).catch(() => undefined);
  return created;
}

async function notifyChatMessageRecipients(opts: {
  channelId: number;
  tenantId: number;
  messageId: number;
  senderId: number | null;
  senderLabel?: string | null;
  messageText?: string | null;
  hasImage: boolean;
}) {
  const channel = await getChannelMeta(opts.channelId);
  const members = await query(
    `SELECT m.user_id,
            COALESCE(t.full_name, os.full_name, u.username) AS member_name
     FROM chat_channel_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
     WHERE m.channel_id = $1
       AND COALESCE(m.notifications_muted, false) = false
       AND ($2::int IS NULL OR m.user_id <> $2)`,
    [opts.channelId, opts.senderId]
  );

  let senderName = opts.senderLabel || 'ScholarNerve Team';
  if (opts.senderId != null) {
    const senderRes = await query(
      `SELECT COALESCE(t.full_name, os.full_name, u.username) AS name
       FROM users u
       LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
       WHERE u.id = $1`,
      [opts.senderId]
    );
    senderName = (senderRes.rows[0]?.name as string) || senderName;
  }

  const body = opts.messageText?.trim() || (opts.hasImage ? '📷 Photo' : 'New message');
  const channelLabel = channel.channel_type === 'dm' ? senderName : `${senderName} · ${channel.name}`;
  const url = `/?module=messages&channel=${opts.channelId}`;

  const { notifyStaffUser } = await import('./staffNotificationService.js');

  await Promise.all(
    members.rows.map(async (row: { user_id: number }) => {
      const userId = Number(row.user_id);
      await notifyStaffUser(userId, opts.tenantId, {
        kind: 'chat',
        title: channelLabel,
        message: body,
        url,
        referenceKey: `chat:${opts.messageId}:${userId}`,
        push: { title: channelLabel, body, url },
      });
    })
  );

  try {
    const { getIO } = await import('../socket.js');
    getIO().to(`tenant:${opts.tenantId}`).emit('tenant-data-changed', {
      tenantId: opts.tenantId,
      entity: 'staff-notification',
    });
    getIO().to(`tenant:${opts.tenantId}`).emit('tenant-data-changed', {
      tenantId: opts.tenantId,
      entity: 'chat',
    });
  } catch {
    /* non-fatal */
  }
}

export async function setChannelNotificationsMuted(
  channelId: number,
  userId: number,
  muted: boolean
): Promise<void> {
  await assertChannelMember(channelId, userId);
  await query(
    `UPDATE chat_channel_members SET notifications_muted = $3 WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId, muted]
  );
}

export async function getMessageById(
  messageId: number,
  viewerUserId: number,
  opts: { superAdminView?: boolean } = {}
) {
  const result = await query(
    `SELECT cm.*,
            COALESCE(t.full_name, os.full_name, u.username) AS sender_name,
            u.role AS sender_role
     FROM chat_messages cm
     LEFT JOIN users u ON u.id = cm.sender_id
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
     WHERE cm.id = $1`,
    [messageId]
  );
  const row = result.rows[0];
  if (!row) throw httpError(404, 'Message not found');
  const mapped = mapMessageRow(row, viewerUserId, opts.superAdminView);
  return {
    ...mapped,
    tenant_id: Number(row.tenant_id),
  };
}

export async function softDeleteMessage(messageId: number, userId: number) {
  const r = await query(`SELECT * FROM chat_messages WHERE id = $1`, [messageId]);
  const row = r.rows[0];
  if (!row) throw httpError(404, 'Message not found');
  if (row.sender_id == null || Number(row.sender_id) !== userId) {
    throw httpError(403, 'You can only delete your own messages');
  }
  if (row.is_deleted) return { id: messageId, channel_id: Number(row.channel_id) };

  await query(
    `UPDATE chat_messages SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
    [messageId]
  );
  return { id: messageId, channel_id: Number(row.channel_id), tenant_id: Number(row.tenant_id) };
}

export async function markChannelRead(channelId: number, userId: number): Promise<void> {
  await assertChannelMember(channelId, userId);
  await query(
    `UPDATE chat_channel_members SET last_read_at = NOW()
     WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );

  try {
    const tenantRow = await query(`SELECT tenant_id FROM chat_channels WHERE id = $1`, [channelId]);
    const tenantId = Number(tenantRow.rows[0]?.tenant_id);
    if (!tenantId) return;
    const { getIO } = await import('../socket.js');
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'chat',
      action: 'read',
      at: Date.now(),
    });
  } catch {
    /* non-fatal */
  }
}

export async function getOrCreateDm(tenantId: number, userId: number, targetUserId: number) {
  if (userId === targetUserId) throw httpError(400, 'Cannot DM yourself');

  const target = await query(
    `SELECT id, role, tenant_id FROM users WHERE id = $1 AND is_active = true`,
    [targetUserId]
  );
  const targetRow = target.rows[0];
  if (!targetRow || Number(targetRow.tenant_id) !== tenantId) {
    throw httpError(403, 'User not in your school');
  }

  const p1 = Math.min(userId, targetUserId);
  const p2 = Math.max(userId, targetUserId);

  const existing = await query(
    `SELECT dc.*, c.name FROM dm_conversations dc
     JOIN chat_channels c ON c.id = dc.channel_id
     WHERE dc.tenant_id = $1 AND dc.participant_one = $2 AND dc.participant_two = $3`,
    [tenantId, p1, p2]
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      dm_conversation_id: Number(row.id),
      channel_id: Number(row.channel_id),
      peer_user_id: targetUserId,
    };
  }

  const peerName = await query(
    `SELECT COALESCE(os.full_name, t.full_name, u.full_name, u.username) AS name
     FROM users u
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
     WHERE u.id = $1`,
    [targetUserId]
  );
  const name = peerName.rows[0]?.name || 'Direct Message';

  const ch = await query(
    `INSERT INTO chat_channels (tenant_id, name, channel_type, description)
     VALUES ($1, $2, 'dm', 'Direct message')
     RETURNING id`,
    [tenantId, name]
  );
  const channelId = Number(ch.rows[0].id);

  await query(
    `INSERT INTO chat_channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)
     ON CONFLICT DO NOTHING`,
    [channelId, userId, targetUserId]
  );

  const dm = await query(
    `INSERT INTO dm_conversations (tenant_id, participant_one, participant_two, channel_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenantId, p1, p2, channelId]
  );

  return {
    dm_conversation_id: Number(dm.rows[0].id),
    channel_id: channelId,
    peer_user_id: targetUserId,
  };
}

export async function listDmStaff(tenantId: number, userId: number, search = '') {
  const q = search.trim().toLowerCase();
  const params: unknown[] = [tenantId, userId];
  let searchSql = '';
  if (q) {
    params.push(`%${q}%`);
    searchSql = `AND (
      LOWER(COALESCE(os.full_name, t.full_name, u.full_name, u.username)) LIKE $${params.length}
      OR LOWER(u.role) LIKE $${params.length}
    )`;
  }

  const result = await query(
    `SELECT u.id,
            COALESCE(os.full_name, t.full_name, u.full_name, u.username) AS name,
            u.role
     FROM users u
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff os ON os.id = u.other_staff_id AND os.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.is_active = true AND u.id <> $2
     ${searchSql}
     ORDER BY name ASC
     LIMIT 100`,
    params
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    role: normalizeRole(row.role),
    avatar_initials: avatarInitials(row.name),
  }));
}

export async function superAdminBroadcast(input: {
  message: string;
  tenantId?: number | null;
}) {
  const text = input.message.trim();
  if (text.length < 1) throw httpError(400, 'Message required');

  const tenants = input.tenantId
    ? [{ id: input.tenantId }]
    : (await query(`SELECT id FROM tenants WHERE is_active = true ORDER BY id`)).rows;

  const posted: Array<{ tenant_id: number; channel_id: number; message_id: number }> = [];

  for (const t of tenants) {
    const tenantId = Number(t.id);
    await ensureTenantChatChannels(tenantId);
    const ch = await query(
      `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = 'general' LIMIT 1`,
      [tenantId]
    );
    const channelId = Number(ch.rows[0]?.id);
    if (!channelId) continue;

    const ins = await query(
      `INSERT INTO chat_messages (channel_id, tenant_id, sender_id, sender_label, message)
       VALUES ($1, $2, NULL, 'ScholarNerve Team', $3)
       RETURNING id`,
      [channelId, tenantId, text]
    );
    posted.push({
      tenant_id: tenantId,
      channel_id: channelId,
      message_id: Number(ins.rows[0].id),
    });
  }

  return posted;
}

export async function getUserChannelIds(userId: number, tenantId: number | null): Promise<number[]> {
  const r = await query(
    `SELECT c.id FROM chat_channel_members m
     JOIN chat_channels c ON c.id = m.channel_id
     WHERE m.user_id = $1 AND (c.tenant_id = $2 OR c.tenant_id IS NULL)`,
    [userId, tenantId]
  );
  return r.rows.map((row) => Number(row.id));
}

export async function getDmConversationIdForChannel(channelId: number): Promise<number | null> {
  const r = await query(`SELECT id FROM dm_conversations WHERE channel_id = $1`, [channelId]);
  return r.rows[0]?.id ? Number(r.rows[0].id) : null;
}

export { avatarInitials, normalizeRole, channelSortOrder };
