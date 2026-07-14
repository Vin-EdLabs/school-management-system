import { apiService } from './api';
import { resolveUploadUrl } from '../utils/mediaUrl';

export type ChatChannelType = 'general' | 'teachers' | 'non_teaching' | 'announcements' | 'dm';

export type ChatChannel = {
  id: number;
  name: string;
  channel_type: ChatChannelType;
  description?: string | null;
  unread_count: number;
  notifications_muted?: boolean;
  dm_conversation_id?: number | null;
  dm_peer?: { name: string; role: string; avatar_initials: string } | null;
  last_message?: {
    sender_name: string;
    sender_id: number | null;
    message?: string | null;
    image_url?: string | null;
    created_at?: string;
    is_platform?: boolean;
  } | null;
};

export type ChatMessage = {
  id: number | string;
  channel_id: number;
  message?: string | null;
  image_url?: string | null;
  image_thumbnail_url?: string | null;
  created_at: string;
  is_deleted: boolean;
  is_mine: boolean;
  /** Local blob preview while an image message is still sending. */
  local_image_preview?: string | null;
  sender?: {
    id: number | null;
    name: string;
    role: string;
    avatar_initials?: string;
  } | null;
  temp_id?: string;
  pending?: boolean;
  failed?: boolean;
};

export const chatService = {
  listChannels() {
    return apiService.get<{ channels: ChatChannel[]; total_unread: number }>('/chat/channels');
  },

  listMessages(channelId: number, beforeId?: number) {
    const q = beforeId ? `?before_id=${beforeId}&limit=30` : '?limit=30';
    return apiService.get<{ messages: ChatMessage[]; channel_type: ChatChannelType }>(
      `/chat/channels/${channelId}/messages${q}`
    );
  },

  sendMessage(
    channelId: number,
    body: { message?: string; image_url?: string; image_thumbnail_url?: string }
  ) {
    return apiService.post<ChatMessage>(`/chat/channels/${channelId}/messages`, body);
  },

  deleteMessage(messageId: number) {
    return apiService.delete<{ ok: boolean }>(`/chat/messages/${messageId}`);
  },

  markRead(channelId: number) {
    return apiService.patch<{ ok: boolean }>(`/chat/channels/${channelId}/read`, {});
  },

  setChannelMuted(channelId: number, muted: boolean) {
    return apiService.patch<{ ok: boolean; muted: boolean }>(`/chat/channels/${channelId}/mute`, { muted });
  },

  getChannelStats(channelId: number) {
    return apiService.get<{ member_count: number; online_count: number }>(`/chat/channels/${channelId}/stats`);
  },

  startDm(targetUserId: number) {
    return apiService.post<{ dm_conversation_id: number; channel_id: number; peer_user_id: number }>(
      '/chat/dm',
      { target_user_id: targetUserId }
    );
  },

  listStaff(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiService.get<{
      items: Array<{ id: number; name: string; role: string; avatar_initials: string }>;
    }>(`/chat/staff${q}`);
  },

  uploadImage(file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return apiService.postForm<{ image_url: string; image_thumbnail_url: string }>(
      '/chat/upload-image',
      fd
    );
  },

  superAdminBroadcast(body: { message: string; tenant_id?: number | null }) {
    return apiService.post<{ posted: number }>('/chat/super-admin/broadcast', body, {
      skipTenant: true,
      skipTenantHeaders: true,
    });
  },

  listSuperAdminSchools() {
    return apiService.get<{ schools: SuperAdminSchoolChat[] }>('/chat/super-admin/schools', {
      skipTenant: true,
      skipTenantHeaders: true,
    });
  },

  listSuperAdminSchoolMessages(tenantId: number, beforeId?: number) {
    const q = beforeId ? `?before_id=${beforeId}&limit=30` : '?limit=30';
    return apiService.get<{ messages: ChatMessage[]; channel_type: ChatChannelType }>(
      `/chat/super-admin/schools/${tenantId}/messages${q}`,
      { skipTenant: true, skipTenantHeaders: true }
    );
  },

  superAdminPostToSchool(
    tenantId: number,
    body: { message?: string; image_url?: string; image_thumbnail_url?: string }
  ) {
    return apiService.post<ChatMessage>(`/chat/super-admin/schools/${tenantId}/messages`, body, {
      skipTenant: true,
      skipTenantHeaders: true,
    });
  },

  superAdminUploadImage(tenantId: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('tenant_id', String(tenantId));
    return apiService.postForm<{ image_url: string; image_thumbnail_url: string }>(
      '/chat/super-admin/upload-image',
      fd,
      { skipTenant: true }
    );
  },
};

export type SuperAdminSchoolChat = {
  tenant_id: number;
  tenant_name: string;
  logo_url: string | null;
  channel_id: number | null;
  unread_count: number;
  last_message?: {
    sender_name: string;
    sender_id: number | null;
    message?: string | null;
    image_url?: string | null;
    created_at?: string;
    is_platform?: boolean;
  } | null;
};

export function resolveChatImageUrl(url: string | null | undefined): string | null {
  return resolveUploadUrl(url);
}

export function isPlatformMessage(msg: ChatMessage): boolean {
  if (msg.is_deleted || msg.is_mine) return false;
  return msg.sender?.role === 'platform' || msg.sender?.id == null;
}

export function chatDisplayName(name: string | null | undefined, fallback = 'Staff'): string {
  const trimmed = String(name ?? '').trim();
  return trimmed || fallback;
}

export function chatInitials(name: string | null | undefined, fallback = '?'): string {
  const parts = chatDisplayName(name, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function roleAccentClass(role: string): string {
  switch (role) {
    case 'teacher':
      return 'text-blue-600 dark:text-blue-400';
    case 'headmaster':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'administrator':
      return 'text-purple-600 dark:text-purple-400';
    case 'finance':
      return 'text-teal-600 dark:text-teal-400';
    case 'platform':
      return 'text-violet-600 dark:text-violet-400';
    default:
      return 'text-slate-600 dark:text-slate-300';
  }
}

export function roleAvatarClass(role: string): string {
  switch (role) {
    case 'teacher':
      return 'bg-blue-100 text-blue-700';
    case 'headmaster':
      return 'bg-indigo-100 text-indigo-700';
    case 'administrator':
      return 'bg-purple-100 text-purple-700';
    case 'finance':
      return 'bg-teal-100 text-teal-800';
    case 'staff':
      return 'bg-slate-100 text-slate-700';
    case 'driver':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
}

export function channelIconType(type: ChatChannelType): string {
  switch (type) {
    case 'announcements':
      return 'megaphone';
    case 'general':
      return 'globe';
    case 'teachers':
      return 'users';
    case 'non_teaching':
      return 'briefcase';
    case 'dm':
      return 'user';
    default:
      return 'message';
  }
}

export function canPostAnnouncements(role: string): boolean {
  return ['administrator', 'headmaster', 'super-admin'].includes(role);
}
