import { apiService } from './api';

export type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'update' | 'urgent' | 'invoice';
export type DisplayStatus = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

export type GlobalAnnouncement = {
  id: number;
  title: string;
  body: string;
  type: AnnouncementType;
  target: 'all' | 'selected';
  target_tenant_ids: number[] | null;
  scheduled_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  read_count?: number;
  eligible_user_count?: number;
  display_status?: DisplayStatus;
  target_label?: string;
};

export type UnreadAnnouncement = {
  id: number;
  title: string;
  body: string;
  type: AnnouncementType;
  created_at: string;
  displayBody: string;
};

export type AnnouncementFormInput = {
  title: string;
  body: string;
  type: AnnouncementType;
  target: 'all' | 'selected';
  targetTenantIds: number[];
  scheduledAt: string;
  expiresAt: string;
  isActive: boolean;
};

export async function fetchSuperAnnouncements(): Promise<GlobalAnnouncement[]> {
  const res = await apiService.get<{ items: GlobalAnnouncement[] }>('/super/announcements');
  return res.items || [];
}

export async function createSuperAnnouncement(input: AnnouncementFormInput): Promise<GlobalAnnouncement> {
  return apiService.post('/super/announcements', {
    title: input.title,
    body: input.body,
    type: input.type,
    target: input.target,
    targetTenantIds: input.target === 'selected' ? input.targetTenantIds : null,
    scheduledAt: input.scheduledAt || null,
    expiresAt: input.expiresAt || null,
    isActive: input.isActive,
  });
}

export async function updateSuperAnnouncement(
  id: number,
  input: AnnouncementFormInput
): Promise<GlobalAnnouncement> {
  return apiService.put(`/super/announcements/${id}`, {
    title: input.title,
    body: input.body,
    type: input.type,
    target: input.target,
    targetTenantIds: input.target === 'selected' ? input.targetTenantIds : null,
    scheduledAt: input.scheduledAt || null,
    expiresAt: input.expiresAt || null,
    isActive: input.isActive,
  });
}

export async function deleteSuperAnnouncement(id: number): Promise<void> {
  await apiService.delete(`/super/announcements/${id}`);
}

export async function toggleSuperAnnouncement(id: number): Promise<GlobalAnnouncement> {
  return apiService.patch(`/super/announcements/${id}/toggle`, {});
}

export async function fetchAnnouncementReaders(id: number): Promise<
  Array<{
    user_id: number;
    full_name: string | null;
    email: string | null;
    tenant_id: number | null;
    read_at: string;
  }>
> {
  const res = await apiService.get<{ readers: any }>(`/super/announcements/${id}/reads`);
  return res.readers || [];
}

export async function fetchUnreadAnnouncements(): Promise<{
  items: UnreadAnnouncement[];
  schoolName: string;
}> {
  return apiService.get('/announcements/unread');
}

export async function markAnnouncementRead(id: number): Promise<void> {
  await apiService.post(`/announcements/${id}/read`, {});
}

export const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'info' as const, label: '📢 General Info', color: 'emerald' },
  { value: 'warning' as const, label: '⚠️ Warning', color: 'amber' },
  { value: 'maintenance' as const, label: '🔧 Maintenance', color: 'blue' },
  { value: 'update' as const, label: '🚀 System Update', color: 'purple' },
  { value: 'urgent' as const, label: '🚨 Urgent', color: 'red' },
];

export const TYPE_BORDER_COLORS: Record<AnnouncementType, string> = {
  info: '#10b981',
  warning: '#f59e0b',
  maintenance: '#3b82f6',
  update: '#8b5cf6',
  urgent: '#ef4444',
  invoice: '#0D7377',
};

export const TYPE_LABELS: Record<AnnouncementType, string> = {
  info: 'GENERAL INFO',
  warning: 'WARNING',
  maintenance: 'MAINTENANCE NOTICE',
  update: 'SYSTEM UPDATE',
  urgent: 'URGENT NOTICE',
  invoice: 'INVOICE',
};

export const TYPE_ICONS: Record<AnnouncementType, string> = {
  info: '📢',
  warning: '⚠️',
  maintenance: '🔧',
  update: '🚀',
  urgent: '🚨',
  invoice: '🧾',
};
