import { apiService } from './api';

export type ComplaintType = 'student' | 'teacher';
export type ComplaintSeverity = 'low' | 'medium' | 'high';
export type ComplaintStatus = 'pending' | 'under_review' | 'resolved';

export type ComplaintPerson = {
  id: number | null;
  name: string;
  role?: string | null;
  kind?: 'student' | 'teacher';
  class_name?: string | null;
};

export type ComplaintHistoryItem = {
  id: number;
  complaint_id: number;
  changed_by: number;
  changed_by_name: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  note: string | null;
  created_at: string;
};

export type Complaint = {
  id: number;
  tenant_id: number;
  complaint_type: ComplaintType;
  title: string;
  description: string;
  severity: ComplaintSeverity;
  is_anonymous: boolean;
  status: ComplaintStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  filed_by: ComplaintPerson;
  subject: ComplaintPerson;
  resolved_by: { id: number; name: string } | null;
  status_history?: ComplaintHistoryItem[];
};

export type ComplaintsListResponse = {
  items: Complaint[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    pending: number;
    under_review: number;
    resolved: number;
    high_severity: number;
  };
};

export type ComplaintTeacherSubject = {
  id: number;
  name: string;
  role: string;
  staff_id: string | null;
};

export const complaintsService = {
  create(body: {
    complaint_type: ComplaintType;
    subject_student_id?: number;
    subject_teacher_id?: number;
    title: string;
    description: string;
    severity: ComplaintSeverity;
    is_anonymous?: boolean;
  }) {
    return apiService.post<Complaint>('/complaints', body);
  },

  list(params?: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') sp.set(k, String(v));
      }
    }
    const qs = sp.toString();
    return apiService.get<ComplaintsListResponse>(`/complaints${qs ? `?${qs}` : ''}`);
  },

  listMine(params?: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') sp.set(k, String(v));
      }
    }
    const qs = sp.toString();
    return apiService.get<ComplaintsListResponse>(`/complaints/my${qs ? `?${qs}` : ''}`);
  },

  getById(id: number) {
    return apiService.get<Complaint>(`/complaints/${id}`);
  },

  updateStatus(id: number, body: { status: 'under_review' | 'resolved'; note?: string }) {
    return apiService.patch<Complaint>(`/complaints/${id}/status`, body);
  },

  listTeacherSubjects() {
    return apiService.get<{ items: ComplaintTeacherSubject[] }>('/complaints/subjects/teachers');
  },

  unreadNotifications() {
    return apiService.get<{
      items: Array<{
        id: number;
        title: string;
        message: string;
        priority: string;
        link: string;
        created_at: string;
      }>;
    }>('/complaints/notifications/unread');
  },

  markNotificationRead(id: number) {
    return apiService.post(`/complaints/notifications/${id}/read`, {});
  },
};

export function severityBadgeClass(severity: ComplaintSeverity): string {
  if (severity === 'high') return 'border-red-300 bg-red-50 text-red-700';
  if (severity === 'medium') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-emerald-300 bg-emerald-50 text-emerald-700';
}

export function statusBadgeClass(status: ComplaintStatus): string {
  if (status === 'resolved') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'under_review') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-slate-300 bg-slate-100 text-slate-600';
}

export function statusLabel(status: ComplaintStatus): string {
  if (status === 'under_review') return 'Under Review';
  if (status === 'resolved') return 'Resolved';
  return 'Pending';
}

export function formatComplaintWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
