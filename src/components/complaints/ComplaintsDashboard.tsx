import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  Flag,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  complaintsService,
  formatComplaintWhen,
  severityBadgeClass,
  statusBadgeClass,
  statusLabel,
  type Complaint,
  type ComplaintSeverity,
  type ComplaintType,
} from '@/services/complaintsService';
import ComplaintStatusTimeline from './ComplaintStatusTimeline';

type Props = {
  readOnly?: boolean;
};

const ComplaintsDashboard: React.FC<Props> = ({ readOnly = false }) => {
  const [tab, setTab] = useState<'active' | 'resolved'>('active');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    under_review: 0,
    resolved: 0,
    high_severity: 0,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | ComplaintType>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | ComplaintSeverity>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintsService.list({
        status: tab === 'active' ? 'active' : 'resolved',
        complaint_type: typeFilter !== 'all' ? typeFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      setItems(data.items || []);
      setSummary(
        data.summary || { total: 0, pending: 0, under_review: 0, resolved: 0, high_severity: 0 }
      );
    } catch (err: unknown) {
      toast({
        title: 'Could not load complaints',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tab, typeFilter, severityFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: Complaint) => {
    setShowResolveForm(false);
    setResolveNote('');
    setSelected(row);
    try {
      const fresh = await complaintsService.getById(row.id);
      setSelected(fresh);
    } catch {
      /* keep list row */
    }
  };

  const markUnderReview = async () => {
    if (!selected || readOnly) return;
    setBusy(true);
    try {
      const updated = await complaintsService.updateStatus(selected.id, { status: 'under_review' });
      setSelected(updated);
      toast({ title: 'Marked under review' });
      await load();
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const resolveComplaint = async () => {
    if (!selected || readOnly) return;
    if (resolveNote.trim().length < 20) {
      toast({ title: 'Resolution note required (min 20 characters)', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const updated = await complaintsService.updateStatus(selected.id, {
        status: 'resolved',
        note: resolveNote.trim(),
      });
      setSelected(updated);
      setShowResolveForm(false);
      toast({ title: 'Complaint resolved' });
      await load();
    } catch (err: unknown) {
      toast({
        title: 'Resolve failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-3.5 pb-6 sm:p-4 md:p-5 sm:pb-8 space-y-4 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-4 sm:p-5 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
            <Flag className="h-3.5 w-3.5" />
            School oversight
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Complaints</h1>
          <p className="text-xs sm:text-sm text-white/75 max-w-xl">
            {readOnly
              ? 'Review student and staff complaints filed by teachers (view only).'
              : 'Review, investigate, and resolve complaints filed by teachers.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total, tone: '' },
          { label: 'Pending', value: summary.pending, tone: '' },
          { label: 'Under Review', value: summary.under_review, tone: '' },
          { label: 'Resolved', value: summary.resolved, tone: '' },
          {
            label: 'High Severity',
            value: summary.high_severity,
            tone: 'border-red-200 bg-red-50 text-red-800',
          },
        ].map((c) => (
          <Card key={c.label} className={cn('rounded-xl shadow-sm', c.tone)}>
            <CardContent className="p-3 sm:p-3.5">
              <p className="text-[11px] uppercase tracking-wide opacity-70">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl bg-muted/80 p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            tab === 'active' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setTab('resolved')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            tab === 'resolved' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          Resolved
        </button>
      </div>

      <Card className="rounded-xl shadow-sm border-border bg-card">
        <CardContent className="p-3 sm:p-3.5 flex flex-col lg:flex-row gap-2.5 lg:items-center flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, subject…"
              className="h-9 pl-9 rounded-lg text-sm bg-background"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-full sm:w-36 h-9 rounded-lg text-xs sm:text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={severityFilter}
            onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}
          >
            <SelectTrigger className="w-full sm:w-36 h-9 rounded-lg text-xs sm:text-sm">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg text-xs sm:text-sm w-full sm:w-auto"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg text-xs sm:text-sm w-full sm:w-auto"
          />
          <Button variant="outline" className="h-9 rounded-lg text-xs sm:text-sm gap-1.5" onClick={() => void load()}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm overflow-hidden border-border bg-card">
        <CardHeader className="border-b bg-muted/30 py-3 px-3.5 sm:px-5">
          <CardTitle className="text-base">{tab === 'active' ? 'Active complaints' : 'Resolved complaints'} ({items.length})</CardTitle>
          <CardDescription className="text-xs">
            High severity rows show a red accent. Anonymous filers stay hidden.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto w-full">
          {loading ? (
            <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No complaints in this view.</div>
          ) : (
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th className="px-2 py-2.5 font-medium whitespace-nowrap pl-3">Date</th>
                    <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Type</th>
                    <th className="px-2 py-2.5 font-medium whitespace-nowrap">Filed By</th>
                    <th className="px-2 py-2.5 font-medium whitespace-nowrap">Subject</th>
                    <th className="px-2 py-2.5 font-medium">Title</th>
                    <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Severity</th>
                    <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Status</th>
                    <th className="px-2.5 py-2.5 font-medium whitespace-nowrap text-right pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-t border-border/80 hover:bg-muted/40 transition-colors',
                        row.severity === 'high' && 'border-l-4 border-l-red-500 bg-red-50/30'
                      )}
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-xs pl-3">{formatComplaintWhen(row.created_at)}</td>
                      <td className="px-1.5 py-2 capitalize whitespace-nowrap text-xs">{row.complaint_type}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {row.is_anonymous ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Lock className="h-3.5 w-3.5" />
                                Anonymous
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              This teacher chose to remain anonymous
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="font-medium">{row.filed_by?.name || '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        <div className="leading-tight">
                          <p className="font-medium text-foreground">{row.subject?.name || '—'}</p>
                          {row.subject?.class_name && (
                            <p className="text-[11px] text-muted-foreground">{row.subject.class_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs font-medium max-w-[200px] truncate">{row.title}</td>
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <Badge variant="outline" className={cn('capitalize text-xs font-normal', severityBadgeClass(row.severity))}>
                          {row.severity}
                        </Badge>
                      </td>
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <Badge variant="outline" className={cn('text-xs font-normal', statusBadgeClass(row.status))}>
                          {statusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap pr-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs rounded-lg gap-1.5"
                          onClick={() => void openDetail(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View & Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
          {selected && (
            <div className="space-y-5 pt-2 pb-8">
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  Filed {formatComplaintWhen(selected.created_at)}
                  {readOnly ? ' · Read only' : ''}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('capitalize', severityBadgeClass(selected.severity))}>
                  {selected.severity} severity
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(selected.status)}>
                  {statusLabel(selected.status)}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {selected.complaint_type}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Filed by</p>
                  <p className="font-semibold mt-1 flex items-center gap-1.5">
                    {selected.is_anonymous ? (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Anonymous
                      </>
                    ) : (
                      selected.filed_by?.name
                    )}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subject</p>
                  <p className="font-semibold mt-1">{selected.subject?.name}</p>
                  {selected.subject?.class_name && (
                    <p className="text-xs text-muted-foreground">{selected.subject.class_name}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Description</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.resolution_note && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 mb-2">Resolution note</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.resolution_note}</p>
                  {selected.resolved_by && (
                    <p className="text-xs text-muted-foreground mt-2">
                      By {selected.resolved_by.name}
                      {selected.resolved_at ? ` · ${formatComplaintWhen(selected.resolved_at)}` : ''}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Status timeline</p>
                <ComplaintStatusTimeline current={selected.status} history={selected.status_history} />
              </div>

              {!readOnly && selected.status === 'pending' && (
                <div className="pt-2 border-t">
                  <Button onClick={() => void markUnderReview()} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Mark Under Review
                  </Button>
                </div>
              )}

              {!readOnly && selected.status === 'under_review' && (
                <div className="space-y-3 pt-2 border-t">
                  {!showResolveForm ? (
                    <Button className="w-full" onClick={() => setShowResolveForm(true)} disabled={busy}>
                      Resolve Complaint
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-xl border p-3">
                      <div className="space-y-1">
                        <Label>Resolution note (required)</Label>
                        <Textarea
                          value={resolveNote}
                          onChange={(e) => setResolveNote(e.target.value)}
                          rows={4}
                          placeholder="Explain the outcome (min 20 characters)"
                          className="rounded-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {resolveNote.trim().length}/20 minimum
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowResolveForm(false)} disabled={busy}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => void resolveComplaint()}
                          disabled={busy || resolveNote.trim().length < 20}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Mark as Resolved
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {readOnly && selected.status !== 'resolved' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 border-t pt-3">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Headmaster view is read-only. Ask an administrator to change status.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ComplaintsDashboard;
