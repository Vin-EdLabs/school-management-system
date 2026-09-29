import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  detailDialogBodyClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
  dialogLabelClass,
  dialogTitleClass,
  formDialogContentClass,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Banknote, Ban, Bell, Building2, Check, ClipboardList, Handshake, Headphones, Loader2, LogIn, Mail,
  PlaySquare, RefreshCw, Search, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import {
  PartnerAdminDetailDialog,
  type AdminCommissionRow,
  type AdminLeadDetail,
  type AdminPartnerDetail,
} from './PartnerAdminDetailDialog';

// ---------------------------------------------------------------------------
// Types (backend snake_case rows)
// ---------------------------------------------------------------------------

type AdminPartner = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  gender?: string | null;
  region: string;
  town?: string | null;
  occupation: string | null;
  momo_number: string;
  momo_network: string;
  schools_target: string | null;
  motivation: string | null;
  heard_from?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_note?: string | null;
  suspension_note?: string | null;
  restoration_note?: string | null;
  partner_id: string | null;
  tier: string;
  created_at: string;
  total_leads: number;
  converted_leads: number;
  total_paid: string | number;
  total_pending: string | number;
};

type AdminLead = {
  id: number;
  school_name: string;
  proprietor_name: string | null;
  phone: string | null;
  region: string | null;
  student_count: string | null;
  demo_meeting_url: string | null;
  status: string;
  plan_amount: string | null;
  commission_rate: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  partner_public_id: string | null;
};

type AdminCommissionOverview = {
  summary: { thisMonth: number; totalPaid: number; totalPending: number };
  pendingByPartner: Array<{
    partner_db_id: number;
    first_name: string;
    last_name: string;
    partner_public_id: string | null;
    schools_count: number;
    total_pending: string | number;
  }>;
  records: Array<{
    id: number;
    school_name: string | null;
    first_name: string;
    last_name: string;
    partner_public_id: string | null;
    month: number;
    year: number;
    plan_amount: string;
    commission_rate: string;
    commission_amount: string;
    status: 'pending' | 'paid';
    momo_reference: string | null;
  }>;
};

type AdminVideo = {
  id: number;
  youtube_url: string;
  title: string;
  description: string | null;
  created_at: string;
  watch_count: number;
};

type School = { id: number; name: string };

const TIER_LABELS: Record<string, string> = {
  partner: 'Partner',
  senior_partner: 'Senior Partner',
  team_leader: 'Team Leader',
  regional_director: 'Regional Director',
};

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'demo_booked', label: 'Demo Booked' },
  { value: 'converted', label: 'Converted' },
  { value: 'dead', label: 'Dead' },
];

const adminGet = <T,>(endpoint: string) =>
  apiService.get<T>(endpoint, { skipTenant: true, skipTenantHeaders: true });

function ghs(n: number | string | null | undefined): string {
  return `GHS ${Number(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
}

function formatAdminDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function monthLabel(month: number, year: number): string {
  return `${new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' })} ${year}`;
}

function youtubeThumb(url: string): string | null {
  const m = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>;
  if (status === 'suspended') return <Badge className="rounded-full bg-red-100 text-red-800 hover:bg-red-100">Suspended</Badge>;
  if (status === 'rejected') return <Badge variant="destructive" className="rounded-full">Rejected</Badge>;
  return <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
}

function LeadStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-sky-100 text-sky-800',
    demo_booked: 'bg-violet-100 text-violet-800',
    converted: 'bg-emerald-100 text-emerald-800',
    dead: 'bg-slate-100 text-slate-600',
  };
  return (
    <Badge className={`rounded-full capitalize hover:opacity-100 ${map[status] || map.new}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PartnersAdminStatsSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl" />
      ))}
    </div>
  );
}

function PartnersAdminTableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex gap-3 border-b pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-3 border-b py-3 last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function PartnersAdminCommissionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-3 h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-0">
          <PartnersAdminTableSkeleton rows={5} cols={4} />
        </CardContent>
      </Card>
    </div>
  );
}

function PartnersAdminVideosListSkeleton() {
  return (
    <div className="divide-y px-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-12 w-20 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5 max-w-xs" />
            <Skeleton className="h-3 w-2/5 max-w-[10rem]" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications + Partner management tab
// ---------------------------------------------------------------------------

function ApplicationsTab({
  partners, loading, onReload, mode,
}: {
  partners: AdminPartner[];
  loading: boolean;
  onReload: () => void;
  mode: 'applications' | 'management';
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>(
    mode === 'management' ? 'approved' : 'all'
  );
  const [mgmtFilter, setMgmtFilter] = useState<'all' | 'approved' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminPartner | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<AdminPartner | null>(null);
  const [suspendNote, setSuspendNote] = useState('');
  const [unsuspendTarget, setUnsuspendTarget] = useState<AdminPartner | null>(null);
  const [unsuspendNote, setUnsuspendNote] = useState('');
  const [detail, setDetail] = useState<{
    partner: AdminPartnerDetail;
    leads: AdminLeadDetail[];
    commissions: AdminCommissionRow[];
  } | null>(null);
  const [payTarget, setPayTarget] = useState<{ id: number; label: string } | null>(null);
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const filtered = useMemo(() => {
    let list = mode === 'management'
      ? partners.filter((p) => p.status === 'approved' || p.status === 'suspended')
      : partners;
    if (mode === 'applications' && filter !== 'all') list = list.filter((p) => p.status === filter);
    if (mode === 'management' && mgmtFilter !== 'all') list = list.filter((p) => p.status === mgmtFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          (p.partner_id || '').toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [partners, filter, mgmtFilter, search, mode]);

  const approve = async (p: AdminPartner) => {
    setBusyId(p.id);
    try {
      const result = await apiService.put<{ partner: AdminPartner }>(
        `/admin/partners/${p.id}/approve`, {}, { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: `Approved — Partner ID ${result?.partner?.partner_id || ''}` });
      onReload();
    } catch (err: any) {
      toast({ title: 'Approval failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await apiService.put(
        `/admin/partners/${rejectTarget.id}/reject`,
        { note: rejectNote.trim() },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Application rejected' });
      setRejectTarget(null);
      setRejectNote('');
      onReload();
    } catch (err: any) {
      toast({ title: 'Rejection failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const suspendPartner = async () => {
    if (!suspendTarget) return;
    setBusyId(suspendTarget.id);
    try {
      await apiService.put(
        `/admin/partners/${suspendTarget.id}/suspend`,
        { note: suspendNote.trim() },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Partner suspended', description: 'Their portal access is now locked.' });
      setSuspendTarget(null);
      setSuspendNote('');
      onReload();
      if (detail?.partner?.id === suspendTarget.id) setDetail(null);
    } catch (err: any) {
      toast({ title: 'Suspend failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const openUnsuspendDialog = (p: AdminPartner) => {
    setUnsuspendNote('');
    setUnsuspendTarget(p);
  };

  const unsuspendPartner = async () => {
    if (!unsuspendTarget) return;
    if (!unsuspendNote.trim()) {
      toast({ title: 'Add a reason for unsuspending this account', variant: 'destructive' });
      return;
    }
    setBusyId(unsuspendTarget.id);
    try {
      await apiService.put(
        `/admin/partners/${unsuspendTarget.id}/unsuspend`,
        { note: unsuspendNote.trim() },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Partner unsuspended', description: 'Full portal access has been restored.' });
      setUnsuspendTarget(null);
      setUnsuspendNote('');
      onReload();
      if (detail?.partner?.id === unsuspendTarget.id) void openDetail(unsuspendTarget);
    } catch (err: any) {
      toast({ title: 'Unsuspend failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const toAdminPartner = (p: AdminPartner | AdminPartnerDetail): AdminPartner => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    whatsapp: 'whatsapp' in p ? p.whatsapp : null,
    gender: 'gender' in p ? p.gender : null,
    region: p.region,
    town: 'town' in p ? p.town : null,
    occupation: p.occupation,
    momo_number: p.momo_number,
    momo_network: p.momo_network,
    schools_target: p.schools_target,
    motivation: p.motivation,
    heard_from: 'heard_from' in p ? p.heard_from : null,
    status: p.status as AdminPartner['status'],
    suspension_note: 'suspension_note' in p ? p.suspension_note : null,
    restoration_note: 'restoration_note' in p ? p.restoration_note : null,
    partner_id: p.partner_id,
    tier: p.tier,
    created_at: p.created_at,
    total_leads: 'total_leads' in p ? Number(p.total_leads || 0) : 0,
    converted_leads: 'converted_leads' in p ? Number(p.converted_leads || 0) : 0,
    total_paid: 'total_paid' in p ? p.total_paid : 0,
    total_pending: 'total_pending' in p ? p.total_pending : 0,
  });

  const openDetail = async (p: AdminPartner) => {
    try {
      const result = await adminGet<{
        partner: AdminPartnerDetail;
        leads: AdminLeadDetail[];
        commissions: AdminCommissionRow[];
      }>(`/admin/partners/${p.id}`);
      setDetail(result);
    } catch (err: any) {
      toast({ title: 'Failed to load partner', description: err?.message, variant: 'destructive' });
    }
  };

  const markPaid = async () => {
    if (!payTarget || !payRef.trim()) return;
    setPaying(true);
    try {
      await apiService.put(
        `/admin/partners/commissions/${payTarget.id}/pay`,
        { momoReference: payRef.trim() },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Commission marked as paid' });
      setPayTarget(null);
      setPayRef('');
      if (detail) void openDetail(detail.partner);
      onReload();
    } catch (err: any) {
      toast({ title: 'Failed to mark paid', description: err?.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {mode === 'applications' && (
          <div className="flex gap-1 rounded-lg border bg-white p-1 dark:bg-slate-900">
            {(['all', 'pending', 'approved', 'rejected', 'suspended'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        {mode === 'management' && (
          <div className="flex gap-1 rounded-lg border bg-white p-1 dark:bg-slate-900">
            {(['all', 'approved', 'suspended'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setMgmtFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  mgmtFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? 'All active' : f}
              </button>
            ))}
          </div>
        )}
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && partners.length === 0 ? (
            <PartnersAdminTableSkeleton rows={8} cols={mode === 'management' ? 9 : 7} />
          ) : filtered.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No partners found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mode === 'management' && <TableHead>Partner ID</TableHead>}
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Region</TableHead>
                    {mode === 'applications' ? (
                      <>
                        <TableHead>Schools Target</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Tier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Schools</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className={mode === 'management' ? 'cursor-pointer' : undefined}
                      onClick={mode === 'management' ? () => void openDetail(p) : undefined}
                    >
                      {mode === 'management' && (
                        <TableCell className="font-mono text-xs font-semibold">{p.partner_id}</TableCell>
                      )}
                      <TableCell className="font-medium">
                        {p.first_name} {p.last_name}
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell>{p.region}</TableCell>
                      {mode === 'applications' ? (
                        <>
                          <TableCell>{p.schools_target || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatAdminDateTime(p.created_at)}
                          </TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full">{TIER_LABELS[p.tier] || p.tier}</Badge>
                          </TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-right">{p.total_leads}</TableCell>
                          <TableCell className="text-right">{p.converted_leads}</TableCell>
                          <TableCell className="text-right text-emerald-700">{ghs(p.total_paid)}</TableCell>
                          <TableCell className="text-right text-amber-700">{ghs(p.total_pending)}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {mode === 'applications' ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => void openDetail(p)}>
                              View details
                            </Button>
                            {p.status === 'pending' && (
                              <>
                                <Button size="sm" disabled={busyId === p.id} onClick={() => void approve(p)}>
                                  {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectTarget(p)}>
                                  <X className="h-3.5 w-3.5" /> Reject
                                </Button>
                              </>
                            )}
                            {p.status === 'suspended' && (
                              <Button size="sm" disabled={busyId === p.id} onClick={() => openUnsuspendDialog(p)}>
                                {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                Unsuspend
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => void openDetail(p)}>
                              Manage
                            </Button>
                            {p.status === 'approved' ? (
                              <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50" onClick={() => setSuspendTarget(p)}>
                                <Ban className="h-3.5 w-3.5" /> Suspend
                              </Button>
                            ) : p.status === 'suspended' ? (
                              <Button size="sm" disabled={busyId === p.id} onClick={() => openUnsuspendDialog(p)}>
                                {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                Unsuspend
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Reject application</DialogTitle>
            <DialogDescription>
              Rejecting {rejectTarget?.first_name} {rejectTarget?.last_name}. You can add an optional note.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <Textarea
              rows={4}
              placeholder="Optional rejection note…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === rejectTarget?.id} onClick={() => void reject()}>
              {busyId === rejectTarget?.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg !border-t-red-500`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={`${dialogTitleClass} flex items-center gap-2 text-red-900 dark:text-red-100`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <Ban className="h-4 w-4" />
              </span>
              Suspend partner account
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              This locks <strong className="text-foreground">{suspendTarget?.first_name} {suspendTarget?.last_name}</strong>&apos;s portal.
              They can still sign in, but cannot refer schools, earn commissions, or access training until restored.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="space-y-2">
              <p className={dialogLabelClass}>Reason for suspension</p>
              <Textarea
                rows={4}
                placeholder="Explain why this account is being suspended (shown to the partner)…"
                value={suspendNote}
                onChange={(e) => setSuspendNote(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The partner will see this message on their locked account screen.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === suspendTarget?.id} onClick={() => void suspendPartner()}>
              {busyId === suspendTarget?.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Suspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unsuspendTarget} onOpenChange={(open) => !open && setUnsuspendTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg !border-t-emerald-500`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={`${dialogTitleClass} flex items-center gap-2 text-emerald-900 dark:text-emerald-100`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Unsuspend partner account
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              Restore full portal access for{' '}
              <strong className="text-foreground">{unsuspendTarget?.first_name} {unsuspendTarget?.last_name}</strong>.
              The partner will receive a notification and email that their account was unsuspended.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            {unsuspendTarget?.suspension_note ? (
              <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Previous suspension reason</p>
                <p className="mt-1 text-sm text-red-900 dark:text-red-200">{unsuspendTarget.suspension_note}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className={dialogLabelClass}>Reason for unsuspending</p>
              <Textarea
                rows={4}
                placeholder="Explain why this account is being unsuspended (shown to the partner)…"
                value={unsuspendNote}
                onChange={(e) => setUnsuspendNote(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This reason is sent in the partner&apos;s unsuspension notification and email.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setUnsuspendTarget(null)}>Cancel</Button>
            <Button disabled={busyId === unsuspendTarget?.id || !unsuspendNote.trim()} onClick={() => void unsuspendPartner()}>
              {busyId === unsuspendTarget?.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Unsuspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartnerAdminDetailDialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        partner={detail?.partner ?? null}
        leads={detail?.leads ?? []}
        commissions={detail?.commissions ?? []}
        onReload={() => {
          if (detail?.partner) void openDetail(detail.partner as AdminPartner);
          onReload();
        }}
        onMarkPaid={(id, label) => setPayTarget({ id, label })}
        onSuspend={(p) => setSuspendTarget({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          region: p.region,
          occupation: p.occupation,
          momo_number: p.momo_number,
          momo_network: p.momo_network,
          schools_target: p.schools_target,
          motivation: p.motivation,
          status: p.status as AdminPartner['status'],
          partner_id: p.partner_id,
          tier: p.tier,
          created_at: p.created_at,
          total_leads: 0,
          converted_leads: 0,
          total_paid: 0,
          total_pending: 0,
        })}
        onUnsuspend={(p) => openUnsuspendDialog(toAdminPartner(p))}
        busyId={busyId}
      />

      {/* Pay dialog */}
      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Mark commission as paid</DialogTitle>
            <DialogDescription>{payTarget?.label}</DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <Input
              placeholder="MoMo reference number"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button disabled={!payRef.trim() || paying} onClick={() => void markPaid()}>
              {paying && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// School leads tab
// ---------------------------------------------------------------------------

function LeadsTab() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [convertTarget, setConvertTarget] = useState<AdminLead | null>(null);
  const [demoBookTarget, setDemoBookTarget] = useState<AdminLead | null>(null);
  const [demoMeetingUrl, setDemoMeetingUrl] = useState('');
  const [bookingDemo, setBookingDemo] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [convertSchoolId, setConvertSchoolId] = useState<string>('');
  const [planAmount, setPlanAmount] = useState('300');
  const [commissionRate, setCommissionRate] = useState('30');
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGet<{ leads: AdminLead[] }>('/admin/partners/leads');
      setLeads(result.leads);
    } catch (err: any) {
      toast({ title: 'Failed to load leads', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!convertTarget || schools.length > 0 || schoolsLoading) return;
    setSchoolsLoading(true);
    void (async () => {
      try {
        const data = await adminGet<School[]>('/schools');
        setSchools(Array.isArray(data) ? data : []);
      } catch {
        /* dropdown stays empty */
      } finally {
        setSchoolsLoading(false);
      }
    })();
  }, [convertTarget, schools.length, schoolsLoading]);

  const updateStatus = async (lead: AdminLead, status: string) => {
    if (status === 'converted') {
      setConvertTarget(lead);
      setConvertSchoolId('');
      setPlanAmount(lead.plan_amount ? String(Number(lead.plan_amount)) : '300');
      setCommissionRate(lead.commission_rate ? String(Number(lead.commission_rate)) : '30');
      return;
    }
    if (status === 'demo_booked') {
      setDemoBookTarget(lead);
      setDemoMeetingUrl(lead.demo_meeting_url || '');
      return;
    }
    try {
      await apiService.put(
        `/admin/partners/leads/${lead.id}/status`, { status },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Lead updated' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed to update lead', description: err?.message, variant: 'destructive' });
    }
  };

  const bookDemo = async () => {
    if (!demoBookTarget) return;
    const url = demoMeetingUrl.trim();
    if (!url) {
      toast({ title: 'Meeting link required', description: 'Paste the Google Meet, Zoom, or Teams link.', variant: 'destructive' });
      return;
    }
    setBookingDemo(true);
    try {
      await apiService.put(
        `/admin/partners/leads/${demoBookTarget.id}/status`,
        { status: 'demo_booked', demoMeetingUrl: url },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Demo booked', description: 'Partner will see the meeting link on My Schools.' });
      setDemoBookTarget(null);
      setDemoMeetingUrl('');
      void load();
    } catch (err: any) {
      toast({ title: 'Failed to book demo', description: err?.message, variant: 'destructive' });
    } finally {
      setBookingDemo(false);
    }
  };

  const convert = async () => {
    if (!convertTarget) return;
    setConverting(true);
    try {
      await apiService.put(
        `/admin/partners/leads/${convertTarget.id}/status`,
        {
          status: 'converted',
          convertedSchoolId: convertSchoolId ? Number(convertSchoolId) : null,
          planAmount: Number(planAmount),
          commissionRate: Number(commissionRate),
        },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: 'Lead converted — commission created 🎉' });
      setConvertTarget(null);
      void load();
    } catch (err: any) {
      toast({ title: 'Conversion failed', description: err?.message, variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  const filtered = statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && leads.length === 0 ? (
            <PartnersAdminTableSkeleton rows={8} cols={7} />
          ) : filtered.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No leads found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Proprietor</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.school_name}</TableCell>
                      <TableCell>{l.proprietor_name || '—'}</TableCell>
                      <TableCell>{l.phone || '—'}</TableCell>
                      <TableCell>{l.region || '—'}</TableCell>
                      <TableCell>
                        {l.first_name} {l.last_name}
                        {l.partner_public_id && (
                          <p className="font-mono text-xs text-muted-foreground">{l.partner_public_id}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(l.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Select value={l.status} onValueChange={(v) => void updateStatus(l, v)}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo booked dialog */}
      <Dialog open={!!demoBookTarget} onOpenChange={(open) => !open && setDemoBookTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Book demo: {demoBookTarget?.school_name}</DialogTitle>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <p className="text-sm text-muted-foreground">
              Paste the meeting link for this school. The partner will see it on that school in My Schools — not a generic page.
            </p>
            <div>
              <p className="mb-1.5 text-sm font-medium">Google Meet / Zoom / Teams link</p>
              <Input
                value={demoMeetingUrl}
                onChange={(e) => setDemoMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setDemoBookTarget(null)}>Cancel</Button>
            <Button onClick={() => void bookDemo()} disabled={bookingDemo}>
              {bookingDemo ? 'Saving…' : 'Save & notify partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert dialog */}
      <Dialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Convert lead: {convertTarget?.school_name}</DialogTitle>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div>
              <p className="mb-1.5 text-sm font-medium">Link to school tenant (optional)</p>
              <Select value={convertSchoolId} onValueChange={setConvertSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder={schoolsLoading ? 'Loading schools…' : 'Select a school…'} />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-sm font-medium">Plan amount (GHS/month)</p>
                <Input type="number" min={1} value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Commission rate (%)</p>
                <Input type="number" min={1} max={100} value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              First 2 months automatically pay the 50% launch bonus; your rate applies afterwards.
            </p>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>Cancel</Button>
            <Button disabled={converting || !Number(planAmount)} onClick={() => void convert()}>
              {converting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Convert Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email tab
// ---------------------------------------------------------------------------

const PARTNER_EMAIL_TEMPLATES = [
  { value: 'application_received', label: 'Application received', hint: 'Sent automatically when a partner registers.' },
  { value: 'approved', label: 'Account approved', hint: 'Welcome email with Partner ID — sent on approval.' },
  { value: 'suspended', label: 'Account suspended', hint: 'Requires a reason. Sent on suspend or manually.' },
  { value: 'restored', label: 'Account unsuspended', hint: 'Sent when a suspended partner is reactivated — include reason.' },
  { value: 'custom', label: 'Custom message', hint: 'Write your own subject and body — uses branded template.' },
] as const;

type PartnerEmailTemplateId = (typeof PARTNER_EMAIL_TEMPLATES)[number]['value'];

function EmailTab({ partners }: { partners: AdminPartner[] }) {
  const [template, setTemplate] = useState<PartnerEmailTemplateId>('approved');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [audience, setAudience] = useState<'all' | 'approved' | 'pending' | 'suspended' | 'specific'>('approved');
  const [partnerDbId, setPartnerDbId] = useState('');
  const [sending, setSending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [history, setHistory] = useState<Array<{
    template: string;
    subject: string;
    body_preview: string | null;
    sent_at: string;
    recipient_count: number;
  }>>([]);

  const loadHistory = useCallback(async () => {
    try {
      const result = await adminGet<{ emails: typeof history }>('/admin/partners/emails');
      setHistory(result.emails);
    } catch {
      /* history is best-effort */
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await apiService.post<{ subject: string; html: string }>(
        '/admin/partners/emails/preview',
        {
          template,
          note: note.trim() || undefined,
          subject: subject.trim() || undefined,
          body: body.trim() || undefined,
          partnerDbId:
            audience === 'specific' && partnerDbId ? Number(partnerDbId) : undefined,
        },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      setPreviewSubject(result.subject);
      setPreviewHtml(result.html);
    } catch {
      setPreviewSubject('');
      setPreviewHtml('');
    } finally {
      setPreviewLoading(false);
    }
  }, [template, note, subject, body, audience, partnerDbId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreview();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loadPreview]);

  const selectedTemplate = PARTNER_EMAIL_TEMPLATES.find((t) => t.value === template);

  const send = async () => {
    if (template === 'custom' && (!subject.trim() || !body.trim())) {
      toast({ title: 'Subject and message are required', variant: 'destructive' });
      return;
    }
    if (template === 'suspended' && !note.trim()) {
      toast({ title: 'Suspension reason is required', variant: 'destructive' });
      return;
    }
    if (template === 'restored' && !note.trim()) {
      toast({ title: 'Unsuspension reason is required', variant: 'destructive' });
      return;
    }
    if (audience === 'specific' && !partnerDbId) {
      toast({ title: 'Select a partner', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const result = await apiService.post<{ sentCount: number; recipientCount: number }>(
        '/admin/partners/emails',
        {
          template,
          audience,
          partnerDbId: partnerDbId ? Number(partnerDbId) : undefined,
          note: note.trim() || undefined,
          subject: subject.trim() || undefined,
          body: body.trim() || undefined,
        },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({
        title: `Email sent to ${result?.sentCount ?? 0} of ${result?.recipientCount ?? 0} partner(s)`,
      });
      if (template === 'custom') {
        setSubject('');
        setBody('');
      }
      if (template === 'suspended' || template === 'restored') setNote('');
      void loadHistory();
      void loadPreview();
    } catch (err: any) {
      toast({ title: 'Failed to send email', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-emerald-600" />
              Compose partner email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={template} onValueChange={(v) => setTemplate(v as PartnerEmailTemplateId)}>
              <SelectTrigger>
                <SelectValue placeholder="Email template" />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_EMAIL_TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate ? (
              <p className="text-xs text-muted-foreground">{selectedTemplate.hint}</p>
            ) : null}

            {template === 'custom' && (
              <>
                <Input placeholder="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea rows={6} placeholder="Message body…" value={body} onChange={(e) => setBody(e.target.value)} />
              </>
            )}

            {(template === 'suspended' || template === 'restored') && (
              <Textarea
                rows={3}
                placeholder={
                  template === 'suspended'
                    ? 'Suspension reason (shown in email)…'
                    : 'Unsuspension reason (shown in email)…'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}

            <div className="flex flex-wrap gap-3">
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All partners</SelectItem>
                  <SelectItem value="approved">Approved only</SelectItem>
                  <SelectItem value="pending">Pending applications</SelectItem>
                  <SelectItem value="suspended">Suspended only</SelectItem>
                  <SelectItem value="specific">Specific partner</SelectItem>
                </SelectContent>
              </Select>
              {audience === 'specific' && (
                <Select value={partnerDbId} onValueChange={setPartnerDbId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select partner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.first_name} {p.last_name} {p.partner_id ? `(${p.partner_id})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button disabled={sending} onClick={() => void send()}>
              {sending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Send email
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-900/50">
            <CardTitle className="text-base">Live email preview</CardTitle>
            <p className="text-xs text-muted-foreground">
              This is exactly how the email will look in the partner&apos;s inbox (sample name: Kofi).
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {previewLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-[520px] animate-pulse rounded-xl bg-muted" />
              </div>
            ) : previewHtml ? (
              <>
                <p className="text-sm">
                  <span className="font-semibold text-muted-foreground">Subject: </span>
                  <span className="font-bold text-foreground">{previewSubject}</span>
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-700">
                  <iframe
                    title="Partner email preview"
                    srcDoc={previewHtml}
                    className="h-[min(560px,70vh)] w-full bg-white"
                    sandbox=""
                  />
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Preview unavailable.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent email history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No emails sent yet.</p>
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto">
              {history.map((h, i) => (
                <div key={`${h.sent_at}-${i}`} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{h.subject}</p>
                    <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                      {h.template.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {h.body_preview ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{h.body_preview}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.sent_at).toLocaleString('en-GH', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {' · '}{h.recipient_count} recipient{h.recipient_count === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications tab
// ---------------------------------------------------------------------------

function NotificationsTab({ partners }: { partners: AdminPartner[] }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'approved' | 'specific'>('approved');
  const [partnerDbId, setPartnerDbId] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Array<{ title: string; body: string; sent_at: string; recipient_count: number }>>([]);

  const loadHistory = useCallback(async () => {
    try {
      const result = await adminGet<{ notifications: typeof history }>('/admin/partners/notifications');
      setHistory(result.notifications);
    } catch {
      /* history is best-effort */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Title and message are required', variant: 'destructive' });
      return;
    }
    if (audience === 'specific' && !partnerDbId) {
      toast({ title: 'Select a partner', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const result = await apiService.post<{ recipientCount: number }>(
        '/admin/partners/notifications',
        { title: title.trim(), body: body.trim(), audience, partnerDbId: partnerDbId ? Number(partnerDbId) : undefined },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: `Notification sent to ${result?.recipientCount ?? 0} partner(s)` });
      setTitle('');
      setBody('');
      void loadHistory();
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={5} placeholder="Message body…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                <SelectItem value="approved">Approved Only</SelectItem>
                <SelectItem value="specific">Specific Partner</SelectItem>
              </SelectContent>
            </Select>
            {audience === 'specific' && (
              <Select value={partnerDbId} onValueChange={setPartnerDbId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select partner…" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.first_name} {p.last_name} {p.partner_id ? `(${p.partner_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button disabled={sending} onClick={() => void send()}>
            {sending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Send Notification
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto">
              {history.map((h, i) => (
                <div key={`${h.sent_at}-${i}`} className="px-5 py-3">
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{h.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.sent_at).toLocaleString('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{h.recipient_count} recipient{h.recipient_count === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Training videos tab
// ---------------------------------------------------------------------------

function VideosTab() {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGet<{ videos: AdminVideo[] }>('/admin/partners/training-videos');
      setVideos(result.videos);
    } catch (err: any) {
      toast({ title: 'Failed to load videos', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const thumb = youtubeThumb(url);

  const add = async () => {
    if (!url.trim() || !title.trim()) {
      toast({ title: 'YouTube URL and title are required', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const result = await apiService.post<{
        video: AdminVideo;
        notifiedCount?: number;
        emailedCount?: number;
        recipientCount?: number;
      }>(
        '/admin/partners/training-videos',
        { youtubeUrl: url.trim(), title: title.trim(), description: description.trim() },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      const notified = result.notifiedCount ?? 0;
      const emailed = result.emailedCount ?? 0;
      toast({
        title: 'Video published',
        description:
          notified > 0
            ? `${notified} partner${notified === 1 ? '' : 's'} notified · ${emailed} email${emailed === 1 ? '' : 's'} sent`
            : 'Live in the partner Training tab (no approved partners to notify yet)',
      });
      setUrl('');
      setTitle('');
      setDescription('');
      void load();
    } catch (err: any) {
      toast({ title: 'Failed to add video', description: err?.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await apiService.delete(`/admin/partners/training-videos/${id}`);
      toast({ title: 'Video deleted' });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add training video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Paste YouTube URL…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {thumb && (
            <img src={thumb} alt="Video preview" className="aspect-video w-full max-w-xs rounded-lg border object-cover" />
          )}
          <Input placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={3} placeholder="Short description…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button disabled={adding} onClick={() => void add()}>
            {adding && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Add Video
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing videos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && videos.length === 0 ? (
            <PartnersAdminVideosListSkeleton />
          ) : videos.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No videos yet.</p>
          ) : (
            <div className="max-h-[28rem] divide-y overflow-y-auto">
              {videos.map((v) => {
                const t = youtubeThumb(v.youtube_url);
                return (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                    {t && <img src={t} alt="" className="h-12 w-20 rounded-md border object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(v.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{v.watch_count} watch{v.watch_count === 1 ? '' : 'es'}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commission overview tab
// ---------------------------------------------------------------------------

function CommissionsTab() {
  const [data, setData] = useState<AdminCommissionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkTarget, setBulkTarget] = useState<AdminCommissionOverview['pendingByPartner'][number] | null>(null);
  const [bulkRef, setBulkRef] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGet<AdminCommissionOverview>('/admin/partners/commissions');
      setData(result);
    } catch (err: any) {
      toast({ title: 'Failed to load commissions', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bulkPay = async () => {
    if (!bulkTarget || !bulkRef.trim()) return;
    setPaying(true);
    try {
      const result = await apiService.put<{ paidCount: number }>(
        `/admin/partners/commissions/0/pay`,
        { momoReference: bulkRef.trim(), bulkPartnerId: bulkTarget.partner_db_id },
        { skipTenant: true, skipTenantHeaders: true } as any
      );
      toast({ title: `Paid ${result?.paidCount ?? 0} commission(s)` });
      setBulkTarget(null);
      setBulkRef('');
      void load();
    } catch (err: any) {
      toast({ title: 'Bulk pay failed', description: err?.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const bulkItems = useMemo(() => {
    if (!bulkTarget || !data) return [];
    return data.records.filter(
      (r) => r.status === 'pending' && r.partner_public_id === bulkTarget.partner_public_id
    );
  }, [bulkTarget, data]);

  if (loading && !data) {
    return <PartnersAdminCommissionsSkeleton />;
  }

  const summary = data?.summary || { thisMonth: 0, totalPaid: 0, totalPending: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Commissions This Month', value: summary.thisMonth, color: 'text-amber-600' },
          { label: 'Total Paid Out', value: summary.totalPaid, color: 'text-emerald-600' },
          { label: 'Total Pending', value: summary.totalPending, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-bold ${s.color}`}>{ghs(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending payouts by partner</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.pendingByPartner || []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No pending commissions. 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Schools</TableHead>
                  <TableHead className="text-right">Total Pending</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.pendingByPartner || []).map((p) => (
                  <TableRow key={p.partner_db_id}>
                    <TableCell className="font-medium">
                      {p.first_name} {p.last_name}
                      {p.partner_public_id && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{p.partner_public_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{p.schools_count}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{ghs(p.total_pending)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setBulkTarget(p)}>
                        <Banknote className="mr-1 h-3.5 w-3.5" /> Bulk Pay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk pay dialog */}
      <Dialog open={!!bulkTarget} onOpenChange={(open) => !open && setBulkTarget(null)}>
        <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>
              Bulk pay — {bulkTarget?.first_name} {bulkTarget?.last_name}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="max-h-52 divide-y overflow-y-auto rounded-lg border">
              {bulkItems.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{c.school_name || 'School'} — {monthLabel(c.month, c.year)}</span>
                  <span className="font-semibold text-amber-600">{ghs(c.commission_amount)}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold">
              Total: <span className="text-amber-600">{ghs(bulkTarget?.total_pending)}</span>
            </p>
            <Input
              placeholder="MoMo reference number"
              value={bulkRef}
              onChange={(e) => setBulkRef(e.target.value)}
            />
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={() => setBulkTarget(null)}>Cancel</Button>
            <Button disabled={!bulkRef.trim() || paying} onClick={() => void bulkPay()}>
              {paying && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Confirm & Pay All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Support tab
// ---------------------------------------------------------------------------

type AdminSupportConversation = {
  partner_db_id: number;
  partner_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  last_message: string;
  last_from_admin: boolean;
  last_message_at: string;
  unread_count: number;
};

type AdminSupportMessage = {
  id: number;
  partner_id?: number;
  sender_role: 'partner' | 'super-admin';
  sender_username: string | null;
  message: string;
  is_from_superadmin: boolean;
  read_at: string | null;
  created_at: string;
};

function SupportTab() {
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshingThread, setRefreshingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.partner_db_id === selectedId) || null;

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await adminGet<{ conversations: AdminSupportConversation[] }>(
        '/admin/partners/support/conversations',
      );
      setConversations(result.conversations || []);
    } catch (err: any) {
      toast({ title: 'Failed to load support conversations', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (partnerDbId: number, opts?: { manual?: boolean }) => {
    const manual = opts?.manual ?? false;
    if (manual) setRefreshingThread(true);
    else setLoadingThread(true);
    try {
      const result = await adminGet<{ messages: AdminSupportMessage[] }>(
        `/admin/partners/support/messages?partnerId=${partnerDbId}`,
      );
      setMessages(result.messages || []);
      await apiService.put(
        '/admin/partners/support/read',
        { partnerId: partnerDbId },
        { skipTenant: true, skipTenantHeaders: true },
      ).catch(() => undefined);
      await loadConversations();
    } catch (err: any) {
      toast({ title: 'Failed to load messages', description: err?.message, variant: 'destructive' });
    } finally {
      if (manual) setRefreshingThread(false);
      else setLoadingThread(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
    else setMessages([]);
  }, [selectedId, loadThread]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loadingThread]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: AdminSupportMessage) => {
      const partnerDbId = Number(msg.partner_id);
      if (!partnerDbId) return;

      if (selectedId === partnerDbId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (!msg.is_from_superadmin) {
          void apiService.put(
            '/admin/partners/support/read',
            { partnerId: partnerDbId },
            { skipTenant: true, skipTenantHeaders: true },
          ).catch(() => undefined);
        }
      } else if (!msg.is_from_superadmin) {
        const preview = msg.message.length > 120 ? `${msg.message.slice(0, 117)}…` : msg.message;
        toast({
          title: 'Partner support message',
          description: preview,
        });
      }

      void loadConversations();
    };

    socket.on('new-partner-support-message', onMessage);
    return () => {
      socket.off('new-partner-support-message', onMessage);
    };
  }, [socket, selectedId, loadConversations]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;

    const text = draft.trim();
    const tempId = -Date.now();
    const optimistic: AdminSupportMessage = {
      id: tempId,
      partner_id: selectedId,
      sender_role: 'super-admin',
      sender_username: 'You',
      message: text,
      is_from_superadmin: true,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setDraft('');
    setMessages((prev) => [...prev, optimistic]);

    try {
      const result = await apiService.post<{ message: AdminSupportMessage }>(
        '/admin/partners/support/messages',
        { partnerId: selectedId, message: text },
        { skipTenant: true, skipTenantHeaders: true },
      );
      setMessages((prev) => prev.map((m) => (m.id === tempId ? result.message : m)));
      await loadConversations();
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      toast({ title: 'Failed to send reply', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Partner support</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Reply to partner messages from the portal Support screen.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loadingList} onClick={() => void loadConversations()}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid min-h-[420px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border">
            {loadingList && conversations.length === 0 ? (
              <PartnersAdminTableSkeleton rows={5} cols={1} />
            ) : conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No support conversations yet.</p>
            ) : (
              <ul className="max-h-[420px] divide-y overflow-y-auto">
                {conversations.map((c) => (
                  <li key={c.partner_db_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.partner_db_id)}
                      className={`flex w-full flex-col gap-1 px-3 py-3 text-left transition hover:bg-muted/50 ${
                        selectedId === c.partner_db_id ? 'bg-emerald-50/80 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {c.first_name} {c.last_name}
                        </p>
                        {c.unread_count > 0 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">{c.unread_count}</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.partner_id || 'Pending'} · {c.email}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{c.last_message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Select a conversation to reply.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <p className="font-semibold">
                      {selected.first_name} {selected.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.partner_id || 'Pending'} · {selected.email}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshingThread}
                    onClick={() => selectedId && void loadThread(selectedId, { manual: true })}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshingThread ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                  {loadingThread ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.is_from_superadmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            m.is_from_superadmin
                              ? 'rounded-br-md bg-emerald-600 text-white'
                              : 'rounded-bl-md border bg-background'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <p className={`mt-1 text-[10px] ${m.is_from_superadmin ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                            {formatAdminDateTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={sendReply} className="flex gap-2 border-t p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="Write a reply…"
                    className="min-h-[44px] resize-none"
                  />
                  <Button type="submit" disabled={sending || !draft.trim()} className="self-end">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Login audit tab
// ---------------------------------------------------------------------------

type AdminLoginAuditEvent = {
  id: number;
  event_type: 'login' | 'logout';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  partner_db_id: number;
  partner_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

function LoginAuditTab({ partners }: { partners: AdminPartner[] }) {
  const [events, setEvents] = useState<AdminLoginAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPartner, setFilterPartner] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filterPartner !== 'all') params.set('partnerId', filterPartner);
      if (filterEvent === 'login' || filterEvent === 'logout') params.set('event', filterEvent);
      const result = await adminGet<{ events: AdminLoginAuditEvent[] }>(
        `/admin/partners/login-audit?${params.toString()}`,
      );
      setEvents(result.events || []);
    } catch (err: any) {
      toast({ title: 'Failed to load login audit', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterPartner, filterEvent]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Partner login audit</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign-in and sign-out activity across the partner portal.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadAudit()}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={filterPartner} onValueChange={setFilterPartner}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All partners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All partners</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.first_name} {p.last_name}{p.partner_id ? ` (${p.partner_id})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="login">Log in</SelectItem>
              <SelectItem value="logout">Log out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && events.length === 0 ? (
          <PartnersAdminTableSkeleton rows={8} cols={6} />
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No login activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.partner_id || 'Pending'} · {e.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          e.event_type === 'login'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }
                      >
                        {e.event_type === 'login' ? 'Log in' : 'Log out'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.ip_address || '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={e.user_agent || ''}>
                      {e.user_agent || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel root
// ---------------------------------------------------------------------------

export default function PartnersAdminPanel() {
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGet<{ partners: AdminPartner[] }>('/admin/partners');
      setPartners(result.partners);
    } catch (err: any) {
      toast({ title: 'Failed to load partners', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  const pendingCount = partners.filter((p) => p.status === 'pending').length;
  const approvedCount = partners.filter((p) => p.status === 'approved').length;
  const suspendedCount = partners.filter((p) => p.status === 'suspended').length;
  const totalLeads = partners.reduce((s, p) => s + Number(p.total_leads || 0), 0);
  const totalPaid = partners.reduce((s, p) => s + Number(p.total_paid || 0), 0);
  const totalPending = partners.reduce((s, p) => s + Number(p.total_pending || 0), 0);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-5 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20">
            <Handshake className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-outfit text-2xl font-black text-emerald-900 dark:text-emerald-100">Partner Network</h1>
            <p className="text-sm text-muted-foreground">
              Review applications, assign Partner IDs, suspend accounts, adjust commissions, and manage payouts.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadPartners()} className="shrink-0">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {loading && partners.length === 0 ? (
          <PartnersAdminStatsSkeleton />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Pending apps', value: pendingCount, tone: 'text-amber-600' },
              { label: 'Active partners', value: approvedCount, tone: 'text-emerald-600' },
              { label: 'Suspended', value: suspendedCount, tone: 'text-red-600' },
              { label: 'School leads', value: totalLeads, tone: 'text-slate-700 dark:text-slate-200' },
              { label: 'Total paid', value: ghs(totalPaid), tone: 'text-emerald-700', small: true },
              { label: 'Pending payout', value: ghs(totalPending), tone: 'text-amber-700', small: true },
            ].map(({ label, value, tone, small }) => (
              <div key={label} className="rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={`mt-0.5 font-black ${tone} ${small ? 'text-base sm:text-lg' : 'text-2xl'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
          <TabsTrigger value="applications" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            <span>Applications</span>
            {pendingCount > 0 && (
              <Badge className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Partners</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>School Leads</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Banknote className="h-3.5 w-3.5 shrink-0" />
            <span>Commissions</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>Email</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <PlaySquare className="h-3.5 w-3.5 shrink-0" />
            <span>Training Videos</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <Headphones className="h-3.5 w-3.5 shrink-0" />
            <span>Support</span>
          </TabsTrigger>
          <TabsTrigger value="login-audit" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl">
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            <span>Login Audit</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <ApplicationsTab partners={partners} loading={loading} onReload={() => void loadPartners()} mode="applications" />
        </TabsContent>
        <TabsContent value="management" className="mt-4">
          <ApplicationsTab partners={partners} loading={loading} onReload={() => void loadPartners()} mode="management" />
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          <LeadsTab />
        </TabsContent>
        <TabsContent value="commissions" className="mt-4">
          <CommissionsTab />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailTab partners={partners} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab partners={partners} />
        </TabsContent>
        <TabsContent value="videos" className="mt-4">
          <VideosTab />
        </TabsContent>
        <TabsContent value="support" className="mt-4">
          <SupportTab />
        </TabsContent>
        <TabsContent value="login-audit" className="mt-4">
          <LoginAuditTab partners={partners} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
