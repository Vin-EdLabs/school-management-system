import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PartnerCommission, PartnerLead, PartnerVideo, partnerApi,
} from '@/services/partnerApi';

const STALE_MS = 1000 * 60 * 3;

function normalizePartnerLead(raw: Record<string, unknown>): PartnerLead {
  return {
    id: Number(raw.id),
    school_name: String(raw.school_name || ''),
    proprietor_name: raw.proprietor_name != null ? String(raw.proprietor_name) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    region: raw.region != null ? String(raw.region) : null,
    student_count: raw.student_count != null ? String(raw.student_count) : null,
    demo_date: raw.demo_date != null ? String(raw.demo_date) : null,
    demo_meeting_url: raw.demo_meeting_url != null ? String(raw.demo_meeting_url) : null,
    status: (raw.status as PartnerLead['status']) || 'new',
    plan_amount: raw.plan_amount != null ? String(raw.plan_amount) : null,
    monthly_commission: raw.monthly_commission ?? 0,
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export type CommissionsResponse = {
  summary: {
    thisMonth: number;
    lastMonth: number;
    totalLifetime: number;
    pendingPayout: number;
  };
  records: PartnerCommission[];
  payouts: PartnerCommission[];
};

export function usePartnerLeads() {
  return useQuery({
    queryKey: ['partner', 'leads'],
    queryFn: async () => {
      const res = await partnerApi.get<{ leads: PartnerLead[] }>('/partners/leads');
      return res.leads;
    },
    staleTime: STALE_MS,
    gcTime: STALE_MS * 3,
  });
}

export function usePartnerCommissions() {
  return useQuery({
    queryKey: ['partner', 'commissions'],
    queryFn: () => partnerApi.get<CommissionsResponse>('/partners/commissions'),
    staleTime: STALE_MS,
    gcTime: STALE_MS * 3,
  });
}

export function usePartnerTrainingVideos() {
  return useQuery({
    queryKey: ['partner', 'training-videos'],
    queryFn: async () => {
      const res = await partnerApi.get<{ videos: PartnerVideo[] }>('/partners/training-videos');
      return res.videos;
    },
    staleTime: STALE_MS,
    gcTime: STALE_MS * 3,
  });
}

export type PartnerNotification = {
  id: number;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function usePartnerNotifications(open: boolean) {
  return useQuery({
    queryKey: ['partner', 'notifications'],
    queryFn: async () => {
      const res = await partnerApi.get<{ notifications: PartnerNotification[] }>(
        '/partners/notifications',
      );
      return res.notifications || [];
    },
    enabled: open,
    staleTime: STALE_MS,
  });
}

export function useInvalidatePartnerQueries() {
  const qc = useQueryClient();
  return {
    invalidateLeads: () => void qc.invalidateQueries({ queryKey: ['partner', 'leads'] }),
    invalidateCommissions: () => void qc.invalidateQueries({ queryKey: ['partner', 'commissions'] }),
    invalidateAll: () => void qc.invalidateQueries({ queryKey: ['partner'] }),
    prependLead: (raw: PartnerLead | Record<string, unknown>) => {
      const lead = 'school_name' in raw && typeof raw.id === 'number'
        ? raw as PartnerLead
        : normalizePartnerLead(raw as Record<string, unknown>);
      qc.setQueryData<PartnerLead[]>(['partner', 'leads'], (old) => {
        if (!old?.length) return [lead];
        if (old.some((item) => item.id === lead.id)) {
          return old.map((item) => (item.id === lead.id ? { ...item, ...lead } : item));
        }
        return [lead, ...old];
      });
    },
  };
}
