import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  complaintsService,
  formatComplaintWhen,
  severityBadgeClass,
  statusBadgeClass,
  statusLabel,
  type Complaint,
} from '@/services/complaintsService';
import FileComplaintDialog from './FileComplaintDialog';
import ComplaintStatusTimeline from './ComplaintStatusTimeline';

const MyComplaintsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    under_review: 0,
    resolved: 0,
    high_severity: 0,
  });
  const [fileOpen, setFileOpen] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintsService.listMine({ limit: 100 });
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl p-3.5 pb-6 sm:p-4 md:p-5 sm:pb-8 space-y-4 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
              <Flag className="h-3.5 w-3.5" />
              My filings
            </div>
            <h1 className="text-2xl font-bold tracking-tight">My Complaints</h1>
            <p className="text-sm text-white/75 max-w-xl">
              Track complaints you have filed. You cannot edit or delete them after submission.
            </p>
          </div>
          <Button
            className="bg-emerald-500 hover:bg-emerald-400 text-white border-0"
            onClick={() => setFileOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            File Complaint
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Filed', value: summary.total },
          { label: 'Pending', value: summary.pending },
          { label: 'Under Review', value: summary.under_review },
          { label: 'Resolved', value: summary.resolved },
        ].map((c) => (
          <Card key={c.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/30 pb-3">
          <CardTitle className="text-base">Complaints</CardTitle>
          <CardDescription>Open a row to see resolution notes and status history.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              You have not filed any complaints yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th className="px-2 py-2.5 font-medium whitespace-nowrap pl-3">Date</th>
                  <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Type</th>
                  <th className="px-2 py-2.5 font-medium whitespace-nowrap">Subject</th>
                  <th className="px-2 py-2.5 font-medium">Title</th>
                  <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Severity</th>
                  <th className="px-1.5 py-2.5 font-medium whitespace-nowrap">Status</th>
                  <th className="px-2.5 py-2.5 font-medium whitespace-nowrap text-right pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-border/80 hover:bg-muted/40 transition-colors',
                      row.severity === 'high' && 'border-l-4 border-l-red-500'
                    )}
                  >
                    <td className="px-2 py-2 whitespace-nowrap text-xs pl-3">{formatComplaintWhen(row.created_at)}</td>
                    <td className="px-1.5 py-2 capitalize whitespace-nowrap text-xs">{row.complaint_type}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap text-xs">{row.subject?.name || '—'}</td>
                    <td className="px-2 py-2 text-xs font-medium max-w-[220px] truncate">{row.title}</td>
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
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs rounded-lg gap-1" onClick={() => setSelected(row)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <FileComplaintDialog open={fileOpen} onOpenChange={setFileOpen} onCreated={() => void load()} />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-md w-full">
          {selected && (
            <div className="space-y-5 pt-2">
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  Filed {formatComplaintWhen(selected.created_at)} · {selected.complaint_type}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('capitalize', severityBadgeClass(selected.severity))}>
                  {selected.severity}
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(selected.status)}>
                  {statusLabel(selected.status)}
                </Badge>
                {selected.is_anonymous && <Badge variant="secondary">Anonymous</Badge>}
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Subject:</span>{' '}
                  <strong>{selected.subject?.name}</strong>
                  {selected.subject?.class_name ? ` · ${selected.subject.class_name}` : ''}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Description</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.status === 'resolved' && selected.resolution_note && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 mb-2">Resolution note</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.resolution_note}</p>
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Status timeline</p>
                <ComplaintStatusTimeline current={selected.status} history={selected.status_history} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MyComplaintsPage;
