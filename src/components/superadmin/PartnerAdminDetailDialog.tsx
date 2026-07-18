import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote, Ban, Building2, IdCard, Loader2, Mail, MapPin, Phone, Plus, Save, ShieldCheck, User, Wallet,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import PartnerCardFront from '@/pages/partners/PartnerCardFront';
import { ScaledCardPreview } from '@/components/id-cards/ScaledCardPreview';
import type { PartnerProfile } from '@/services/partnerApi';
import { HEARD_FROM_OPTIONS, PARTNER_GENDERS } from '@/services/partnerApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DetailField,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  dialogTitleClass,
  dialogSectionClass,
} from '@/components/ui/dialog';

export type AdminPartnerDetail = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  gender: string | null;
  region: string;
  town: string | null;
  occupation: string | null;
  momo_number: string;
  momo_network: string;
  schools_target: string | null;
  motivation: string | null;
  heard_from: string | null;
  status: string;
  partner_id: string | null;
  tier: string;
  rejection_note: string | null;
  suspension_note?: string | null;
  restoration_note?: string | null;
  profile_photo_url?: string | null;
  created_at: string;
};

export type AdminLeadDetail = {
  id: number;
  school_name: string;
  proprietor_name: string | null;
  phone: string | null;
  region: string | null;
  student_count: string | null;
  status: string;
  plan_amount: string | null;
  commission_rate: string | null;
  notes: string | null;
  created_at: string;
};

export type AdminCommissionRow = {
  id: number;
  school_name: string | null;
  month: number;
  year: number;
  plan_amount: string;
  commission_rate: string;
  commission_amount: string;
  status: 'pending' | 'paid';
  momo_reference: string | null;
  paid_at: string | null;
};

const TIER_LABELS: Record<string, string> = {
  partner: 'Partner',
  senior_partner: 'Senior Partner',
  team_leader: 'Team Leader',
  regional_director: 'Regional Director',
};

function ghs(n: number | string | null | undefined): string {
  return `GHS ${Number(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
}

function monthLabel(month: number, year: number): string {
  return `${new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' })} ${year}`;
}

function genderLabel(value: string | null | undefined): string {
  const match = PARTNER_GENDERS.find((g) => g.value === value);
  if (match) return match.label;
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function heardFromLabel(value: string | null | undefined): string {
  const match = HEARD_FROM_OPTIONS.find((o) => o.value === value);
  return match?.label || value || '—';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>;
  }
  if (status === 'suspended') {
    return <Badge className="rounded-full bg-red-100 text-red-800 hover:bg-red-100">Suspended</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive" className="rounded-full">Rejected</Badge>;
  }
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

function toPartnerProfile(p: AdminPartnerDetail): PartnerProfile {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    phone: p.phone,
    whatsapp: p.whatsapp,
    region: p.region,
    occupation: p.occupation,
    momoNumber: p.momo_number,
    momoNetwork: p.momo_network,
    schoolsTarget: p.schools_target,
    status: p.status as PartnerProfile['status'],
    partnerId: p.partner_id,
    tier: p.tier as PartnerProfile['tier'],
    profilePhotoUrl: p.profile_photo_url,
    suspensionNote: p.suspension_note,
    createdAt: p.created_at,
  };
}

function RecordMonthCommission({
  partnerId,
  leads,
  onSaved,
}: {
  partnerId: number;
  leads: AdminLeadDetail[];
  onSaved: () => void;
}) {
  const converted = leads.filter((l) => l.status === 'converted');
  const now = new Date();
  const [leadId, setLeadId] = useState('');
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${now.getMonth() + 1}`);
  const [plan, setPlan] = useState('300');
  const [rate, setRate] = useState('30');
  const [amount, setAmount] = useState('');
  const [manualAmount, setManualAmount] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string; m: number; y: number }[] = [];
    for (let i = -2; i <= 14; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      opts.push({
        value: `${y}-${m}`,
        label: monthLabel(m, y),
        m,
        y,
      });
    }
    return opts;
  }, [now]);

  useEffect(() => {
    const lead = converted.find((l) => String(l.id) === leadId);
    if (lead?.plan_amount) setPlan(String(Number(lead.plan_amount)));
    if (lead?.commission_rate) setRate(String(Number(lead.commission_rate)));
  }, [leadId, converted]);

  const computed = Math.round(Number(plan || 0) * Number(rate || 0)) / 100;

  const save = async () => {
    if (!leadId) {
      toast({ title: 'Select a converted school', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const [y, m] = monthKey.split('-').map(Number);
      await apiService.post(
        '/admin/partners/commissions',
        {
          partnerId,
          leadId: Number(leadId),
          month: m,
          year: y,
          planAmount: Number(plan),
          commissionRate: Number(rate),
          commissionAmount: manualAmount && amount ? Number(amount) : undefined,
        },
        { skipTenant: true, skipTenantHeaders: true } as any,
      );
      toast({ title: 'Commission recorded for selected month' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Failed to record commission', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (converted.length === 0) return null;

  return (
    <div className={`${dialogSectionClass} border-dashed border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10`}>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">
        Record commission for month (lifetime payouts)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Select a converted school and month — useful for next-month or catch-up lifetime commissions.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">School</p>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Converted school…" /></SelectTrigger>
            <SelectContent>
              {converted.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>{l.school_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Month</p>
          <Select value={monthKey} onValueChange={setMonthKey}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Plan (GHS/mo)</p>
          <Input type="number" min={1} value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Rate (%)</p>
          <Input type="number" min={1} max={100} value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Amount (GHS)</p>
          <Input
            type="number"
            min={1}
            value={manualAmount ? amount : String(computed || '')}
            disabled={!manualAmount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
          <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={manualAmount} onChange={(e) => setManualAmount(e.target.checked)} />
            Override amount manually
          </label>
        </div>
      </div>
      <Button size="sm" className="mt-3" disabled={saving || !leadId} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
        Add commission for month
      </Button>
    </div>
  );
}

function CommissionAdjustRow({
  row,
  onSaved,
}: {
  row: AdminCommissionRow;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState(String(Number(row.plan_amount) || ''));
  const [rate, setRate] = useState(String(Number(row.commission_rate) || ''));
  const [amount, setAmount] = useState(String(Number(row.commission_amount) || ''));
  const [manualAmount, setManualAmount] = useState(false);
  const [saving, setSaving] = useState(false);

  const computed = Math.round(Number(plan || 0) * Number(rate || 0)) / 100;

  useEffect(() => {
    setPlan(String(Number(row.plan_amount) || ''));
    setRate(String(Number(row.commission_rate) || ''));
    setAmount(String(Number(row.commission_amount) || ''));
    setManualAmount(false);
  }, [row.id, row.plan_amount, row.commission_rate, row.commission_amount]);

  const save = async () => {
    setSaving(true);
    try {
      await apiService.put(
        `/admin/partners/commissions/${row.id}`,
        {
          planAmount: Number(plan),
          commissionRate: Number(rate),
          commissionAmount: manualAmount ? Number(amount) : undefined,
        },
        { skipTenant: true, skipTenantHeaders: true } as any,
      );
      toast({ title: 'Commission updated — visible on partner dashboard' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (row.status === 'paid') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div>
          <p className="font-semibold text-foreground">{row.school_name || 'School'} — {monthLabel(row.month, row.year)}</p>
          <p className="text-xs text-muted-foreground">
            {ghs(row.plan_amount)} plan · {Number(row.commission_rate)}%
            {row.momo_reference ? ` · Ref: ${row.momo_reference}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-emerald-700 dark:text-emerald-400">{ghs(row.commission_amount)}</span>
          <Badge className="rounded-full bg-emerald-100 text-emerald-800">Paid</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{row.school_name || 'School'}</p>
          <p className="text-xs text-muted-foreground">{monthLabel(row.month, row.year)} · Pending</p>
        </div>
        <span className="text-lg font-black text-amber-700 dark:text-amber-400">
          {ghs(manualAmount ? amount : computed)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Plan (GHS/mo)</p>
          <Input type="number" min={1} value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Rate (%)</p>
          <Input type="number" min={1} max={100} value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Amount (GHS)</p>
          <Input
            type="number"
            min={1}
            value={manualAmount ? amount : String(computed || '')}
            disabled={!manualAmount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
          <label className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={manualAmount} onChange={(e) => setManualAmount(e.target.checked)} />
            Manual override
          </label>
        </div>
      </div>
      <Button size="sm" className="mt-3" disabled={saving || !Number(plan)} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
        Save & notify partner
      </Button>
    </div>
  );
}

export function PartnerAdminDetailDialog({
  open,
  onOpenChange,
  partner,
  leads,
  commissions,
  onReload,
  onMarkPaid,
  onSuspend,
  onUnsuspend,
  busyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: AdminPartnerDetail | null;
  leads: AdminLeadDetail[];
  commissions: AdminCommissionRow[];
  onReload: () => void;
  onMarkPaid: (commissionId: number, label: string) => void;
  onSuspend?: (partner: AdminPartnerDetail) => void;
  onUnsuspend?: (partner: AdminPartnerDetail) => void;
  busyId?: number | null;
}) {
  if (!partner || !open) return null;

  const profile = toPartnerProfile(partner);
  const initials = `${partner.first_name[0] || ''}${partner.last_name[0] || ''}`.toUpperCase();
  const totalPending = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.commission_amount), 0);
  const totalPaid = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogContentWideClass}>
        <DialogHeader className={detailDialogHeaderClass}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-lg font-black text-emerald-800 dark:border-emerald-800 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200">
              {partner.profile_photo_url ? (
                <img src={partner.profile_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className={dialogTitleClass}>
                {partner.first_name} {partner.last_name}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={partner.status} />
                {partner.partner_id ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {partner.partner_id}
                  </span>
                ) : null}
                <Badge variant="outline" className="rounded-full">{TIER_LABELS[partner.tier] || partner.tier}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className={detailDialogBodyClass}>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 bg-emerald-50/80 p-1 dark:bg-emerald-950/30">
              <TabsTrigger value="idcard" className="gap-1.5"><IdCard className="h-3.5 w-3.5" /> ID Card</TabsTrigger>
              <TabsTrigger value="profile" className="gap-1.5"><User className="h-3.5 w-3.5" /> Profile</TabsTrigger>
              <TabsTrigger value="schools" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Schools ({leads.length})</TabsTrigger>
              <TabsTrigger value="commissions" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Commissions ({commissions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="idcard" className="mt-0 space-y-4">
              {partner.status === 'approved' && partner.partner_id ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-amber-50/50 p-5 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900">
                  <p className="text-center text-sm font-semibold text-muted-foreground">
                    Official Partner ID — what schools see when this partner visits.
                  </p>
                  <ScaledCardPreview scale={0.55}>
                    <PartnerCardFront partner={profile} />
                  </ScaledCardPreview>
                  <p className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-300">{partner.partner_id}</p>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  ID card is available after the partner is approved and assigned a Partner ID.
                </p>
              )}
            </TabsContent>

            <TabsContent value="profile" className="mt-0 space-y-4">
              <div className={dialogSectionClass}>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">About you</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="First name">{partner.first_name}</DetailField>
                  <DetailField label="Last name">{partner.last_name}</DetailField>
                  <DetailField label="Gender">{genderLabel(partner.gender)}</DetailField>
                  <DetailField label="Phone">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {partner.phone}
                    </span>
                  </DetailField>
                  <DetailField label="WhatsApp">{partner.whatsapp || partner.phone || '—'}</DetailField>
                  <DetailField label="Email" className="sm:col-span-2">
                    <span className="flex items-start gap-1.5 break-all">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{partner.email}</span>
                    </span>
                  </DetailField>
                </div>
              </div>

              <div className={dialogSectionClass}>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">Your area</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="Region">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {partner.region}
                    </span>
                  </DetailField>
                  <DetailField label="Town / city">{partner.town || '—'}</DetailField>
                  <DetailField label="Occupation" className="sm:col-span-2">{partner.occupation || '—'}</DetailField>
                </div>
              </div>

              <div className={dialogSectionClass}>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">Get paid</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="MoMo number">{partner.momo_number}</DetailField>
                  <DetailField label="MoMo network">{partner.momo_network}</DetailField>
                </div>
              </div>

              <div className={dialogSectionClass}>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">Your goals</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="How they heard about us" className="sm:col-span-2">
                    {heardFromLabel(partner.heard_from)}
                  </DetailField>
                  <DetailField label="Schools they can reach">
                    {partner.schools_target ? `${partner.schools_target} schools` : '—'}
                  </DetailField>
                  <DetailField label="Applied">
                    {new Date(partner.created_at).toLocaleString('en-GH', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </DetailField>
                  <DetailField label="Why they want to partner" className="sm:col-span-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{partner.motivation?.trim() || '—'}</p>
                  </DetailField>
                </div>
              </div>

              <div className={dialogSectionClass}>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-300/80">Account</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="Partner ID">{partner.partner_id || 'Assigned on approval'}</DetailField>
                  <DetailField label="Tier">{TIER_LABELS[partner.tier] || partner.tier}</DetailField>
                </div>
              </div>

              {partner.rejection_note ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Rejection note</p>
                  <p className="mt-1 text-sm text-red-900 dark:text-red-200">{partner.rejection_note}</p>
                </div>
              ) : null}

              {partner.suspension_note ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Suspension reason</p>
                  <p className="mt-1 text-sm text-red-900 dark:text-red-200">{partner.suspension_note}</p>
                </div>
              ) : null}

              {partner.restoration_note ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Last unsuspension reason</p>
                  <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">{partner.restoration_note}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900/40 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Leads</p>
                  <p className="text-xl font-black text-foreground">{leads.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900/40 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Paid out</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{ghs(totalPaid)}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white p-3 dark:border-amber-900/40 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Pending</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-400">{ghs(totalPending)}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schools" className="mt-0 space-y-3">
              {leads.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No referred schools yet.</p>
              ) : (
                leads.map((l) => (
                  <div key={l.id} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{l.school_name}</p>
                        {l.proprietor_name ? <p className="text-xs text-muted-foreground">{l.proprietor_name}</p> : null}
                      </div>
                      <LeadStatusChip status={l.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {l.phone && <span>{l.phone}</span>}
                      {l.region && <span>{l.region}</span>}
                      {l.student_count && <span>{l.student_count} students</span>}
                      <span>{new Date(l.created_at).toLocaleDateString('en-GH')}</span>
                      {l.plan_amount && Number(l.plan_amount) > 0 && (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {ghs(l.plan_amount)}/mo · {Number(l.commission_rate || 30)}%
                        </span>
                      )}
                    </div>
                    {l.notes ? <p className="mt-2 text-xs italic text-muted-foreground">{l.notes}</p> : null}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="commissions" className="mt-0 space-y-3">
              <RecordMonthCommission partnerId={partner.id} leads={leads} onSaved={onReload} />
              {commissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No commissions yet. Convert a school lead to create one.</p>
              ) : (
                commissions.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <CommissionAdjustRow row={c} onSaved={onReload} />
                    {c.status === 'pending' ? (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkPaid(c.id, `${c.school_name || 'School'} — ${monthLabel(c.month, c.year)}`)}
                        >
                          <Banknote className="mr-1 h-3.5 w-3.5" /> Mark paid via MoMo
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-wrap gap-2`}>
          {partner.status === 'approved' && onSuspend ? (
            <Button variant="destructive" size="sm" onClick={() => onSuspend(partner)}>
              <Ban className="mr-1 h-3.5 w-3.5" /> Suspend account
            </Button>
          ) : null}
          {partner.status === 'suspended' && onUnsuspend ? (
            <Button size="sm" disabled={busyId === partner.id} onClick={() => onUnsuspend(partner)}>
              {busyId === partner.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
              Unsuspend account
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
