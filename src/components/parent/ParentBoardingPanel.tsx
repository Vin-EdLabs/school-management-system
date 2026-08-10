import React, { useCallback, useEffect, useState } from 'react';
import { BedDouble, DoorOpen, AlertTriangle, CalendarCheck, CreditCard, Plus, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  formDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  dialogTitleClass,
  dialogLabelClass,
} from '@/components/ui/dialog';
import { formatGhs } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export type ParentBoardingData = {
  available: boolean;
  reason?: string;
  status?: string;
  dorm_name?: string;
  term_name?: string;
  year_name?: string;
  boarding_fee?: { amount: number; paid: number; outstanding: number; status: string };
  exeats?: Array<{
    id: number;
    type?: string;
    status: string;
    departure_date?: string;
    return_date?: string;
    destination?: string;
  }>;
  complaints?: Array<{
    id: number;
    title: string;
    severity: string;
    status: string;
    parent_summary?: string;
    created_at?: string;
  }>;
  roll_call?: Array<{ date: string; status: string }>;
  weekly_menu?: {
    items: Array<{ day_of_week: number; meal_type: string; menu_item: string }>;
  };
};

type Props = {
  token: string;
  parentFetch: (path: string, opts: RequestInit, token: string) => Promise<Record<string, unknown>>;
  onPayBoarding?: () => void;
};

const statusClass = (s: string) => {
  if (s === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (s === 'partial') return 'bg-amber-100 text-amber-800';
  if (s === 'unpaid') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
};

const exeatClass = (s: string) => {
  if (s === 'approved' || s === 'returned') return 'bg-emerald-100 text-emerald-800';
  if (s === 'pending') return 'bg-amber-100 text-amber-800';
  if (s === 'rejected' || s === 'overdue') return 'bg-red-100 text-red-800';
  return 'bg-sky-100 text-sky-800';
};

export const ParentBoardingPanel: React.FC<Props> = ({ token, parentFetch, onPayBoarding }) => {
  const [data, setData] = useState<ParentBoardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exeatOpen, setExeatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'exeat' as 'exeat' | 'weekend',
    guardian_name: '',
    guardian_phone: '',
    destination: '',
    departure_date: '',
    return_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = (await parentFetch('/parent/boarding', {}, token)) as ParentBoardingData;
      setData(d);
    } catch {
      setData({ available: false, reason: 'Unable to load boarding information' });
    } finally {
      setLoading(false);
    }
  }, [token, parentFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitExeat = async () => {
    if (!form.departure_date || !form.return_date) {
      toast({ title: 'Dates required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await parentFetch('/parent/boarding/exeats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }, token);
      toast({ title: 'Exeat request submitted' });
      setExeatOpen(false);
      await load();
    } catch (e) {
      toast({ title: 'Submission failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border bg-white/70 p-8 text-center text-sm text-slate-500">Loading boarding…</div>;
  }

  if (!data?.available) {
    return (
      <div className="rounded-2xl border border-dashed bg-white/60 p-10 text-center text-sm text-slate-500">
        {data?.reason || 'Boarding information is not available for this student.'}
      </div>
    );
  }

  const fee = data.boarding_fee;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Boarding Status</h2>
              <Badge className="bg-emerald-100 text-emerald-800 border-0">Boarder</Badge>
            </div>
            <p className="text-sm text-slate-600 mt-2">Dorm: {data.dorm_name || '—'}</p>
            <p className="text-xs text-slate-500">{data.term_name} {data.year_name}</p>
          </div>
          <Button size="sm" className="rounded-xl" onClick={() => setExeatOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Request exeat
          </Button>
        </div>
      </div>

      {fee && fee.amount > 0 ? (
        <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-violet-600" />
            <h3 className="font-semibold text-sm">Boarding fee</h3>
            <Badge className={`border-0 text-[10px] capitalize ${statusClass(fee.status)}`}>{fee.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-semibold">{formatGhs(fee.amount)}</p></div>
            <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold">{formatGhs(fee.paid)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-semibold">{formatGhs(fee.outstanding)}</p></div>
          </div>
          {fee.outstanding > 0 && onPayBoarding ? (
            <Button className="mt-4 w-full rounded-xl" variant="primaryAction" onClick={onPayBoarding}>Pay boarding fee</Button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">This week&apos;s meals</h3>
        </div>
        {data.weekly_menu?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-2">Day</th>
                  <th className="py-1 pr-2">Breakfast</th>
                  <th className="py-1 pr-2">Lunch</th>
                  <th className="py-1">Dinner</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
                  const labels = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                  const cell = (meal: string) =>
                    data.weekly_menu?.items.find((i) => i.day_of_week === day && i.meal_type === meal)?.menu_item || '—';
                  return (
                    <tr key={day} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{labels[day]}</td>
                      <td className="py-2 pr-2 text-slate-600">{cell('breakfast')}</td>
                      <td className="py-2 pr-2 text-slate-600">{cell('lunch')}</td>
                      <td className="py-2 text-slate-600">{cell('dinner')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">The weekly menu has not been published yet.</p>
        )}
      </div>

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <DoorOpen className="h-4 w-4 text-sky-600" />
          <h3 className="font-semibold text-sm">Exeat requests</h3>
        </div>
        {(data.exeats || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No exeat requests yet.</p>
        ) : (
          <div className="space-y-3">
            {(data.exeats || []).map((x) => (
              <div key={x.id} className="rounded-xl border border-border/80 bg-muted/20 p-3.5 dark:bg-muted/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm capitalize text-foreground">{x.type || 'exeat'}</p>
                      <Badge className={`border-0 text-[10px] capitalize ${exeatClass(x.status)}`}>{x.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 dark:bg-card/60">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Travel dates</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {formatDisplayDate(x.departure_date, '—')} → {formatDisplayDate(x.return_date, '—')}
                      </p>
                    </div>
                    {x.destination ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
                        <p className="mt-0.5 text-sm text-foreground break-words">{x.destination}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">Complaints</h3>
        </div>
        {(data.complaints || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No concerns logged.</p>
        ) : (
          <div className="space-y-2">
            {(data.complaints || []).map((c) => (
              <div key={c.id} className={`rounded-xl p-3 text-sm ${c.severity === 'high' ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{c.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{c.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{c.parent_summary || 'Please contact the school for details.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Roll call (last 7 nights)</h3>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {(data.roll_call || []).slice(0, 7).map((r) => (
            <div key={String(r.date)} className="text-center">
              <div
                className={`h-10 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                  r.status === 'present'
                    ? 'bg-emerald-100 text-emerald-800'
                    : r.status === 'on_exeat'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {r.status === 'on_exeat' ? 'Exeat' : r.status === 'present' ? '✓' : '✗'}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{String(r.date).slice(5)}</p>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={exeatOpen} onOpenChange={setExeatOpen}>
        <DialogContent className={formDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <DoorOpen className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className={dialogTitleClass}>Submit exeat request</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Request an official exeat or weekend sign-out for your boarder. The school will review and approve.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div>
              <Label className={dialogLabelClass}>Request type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'exeat' | 'weekend' }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exeat">Official exeat</SelectItem>
                  <SelectItem value="weekend">Weekend sign-out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={dialogLabelClass}>Guardian name</Label>
              <Input className="mt-1.5 rounded-xl" value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} placeholder="Full name of person picking up" />
            </div>
            <div>
              <Label className={dialogLabelClass}>Guardian phone</Label>
              <Input className="mt-1.5 rounded-xl" value={form.guardian_phone} onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} placeholder="Contact number" />
            </div>
            <div>
              <Label className={dialogLabelClass}>Destination</Label>
              <Textarea className="mt-1.5 rounded-xl min-h-[80px]" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="Where the student will stay during the exeat" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className={dialogLabelClass}>Departure date</Label>
                <Input type="date" className="mt-1.5 rounded-xl" value={form.departure_date} onChange={(e) => setForm((f) => ({ ...f, departure_date: e.target.value }))} />
              </div>
              <div>
                <Label className={dialogLabelClass}>Return date</Label>
                <Input type="date" className="mt-1.5 rounded-xl" value={form.return_date} onChange={(e) => setForm((f) => ({ ...f, return_date: e.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" className="rounded-xl" onClick={() => setExeatOpen(false)}>Cancel</Button>
            <Button variant="primaryAction" className="rounded-xl" disabled={saving} onClick={() => void submitExeat()}>
              {saving ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentBoardingPanel;
