import React, { useEffect, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, History } from 'lucide-react';
import { apiService } from '@/services/api';
import { formatDisplayDate } from '@/utils/dateFormat';
import { DetailField } from '@/components/ui/dialog';

export type TeacherStatusHistoryEntry = {
  id: number;
  action: string;
  summary: string | null;
  performedBy: string;
  createdAt: string;
  reason: string | null;
  notes: string | null;
  suspensionStartDate: string | null;
  suspensionEndDate: string | null;
  effectiveDate: string | null;
  previousStatus: string | null;
  previousClass: string | null;
  newStatus: string | null;
};

function actionLabel(action: string): string {
  switch (action) {
    case 'TEACHER_SUSPENDED':
      return 'Suspended';
    case 'TEACHER_DEACTIVATED':
      return 'Deactivated';
    case 'TEACHER_REACTIVATED':
      return 'Reactivated';
    case 'SOFT_DELETE':
      return 'Removed from active list';
    default:
      return action.replace(/_/g, ' ');
  }
}

function actionBadgeClass(action: string): string {
  switch (action) {
    case 'TEACHER_SUSPENDED':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'TEACHER_DEACTIVATED':
    case 'SOFT_DELETE':
      return 'bg-red-100 text-red-900 border-red-200';
    case 'TEACHER_REACTIVATED':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    default:
      return 'bg-muted text-foreground';
  }
}

const TeacherStatusHistory: React.FC<{ teacherId: string; open: boolean }> = ({ teacherId, open }) => {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<TeacherStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setLoaded(false);
      setEntries([]);
    }
  }, [open, teacherId]);

  useEffect(() => {
    if (!expanded || loaded || !teacherId) return;
    setLoading(true);
    void apiService
      .get<{ entries?: TeacherStatusHistoryEntry[] }>(`/teachers/${teacherId}/status-history`)
      .then((res) => setEntries(Array.isArray(res?.entries) ? res.entries : []))
      .catch(() => setEntries([]))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [expanded, loaded, teacherId]);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 rounded-2xl transition-colors">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            <History className="h-4 w-4" />
            Status history
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-emerald-700 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-emerald-100/80 px-4 py-4 dark:border-emerald-900/40">
          {loading ? (
            <p className="text-sm text-muted-foreground py-2">Loading history…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No suspend, deactivate, or reactivation records yet.</p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border/70 bg-card p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className={actionBadgeClass(entry.action)}>{actionLabel(entry.action)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDisplayDate(entry.createdAt)} · {entry.performedBy}
                    </span>
                  </div>
                  {entry.summary ? (
                    <p className="text-sm text-foreground">{entry.summary}</p>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {entry.reason ? (
                      <DetailField label="Reason">{entry.reason}</DetailField>
                    ) : null}
                    {entry.notes ? (
                      <DetailField label="Notes">{entry.notes}</DetailField>
                    ) : null}
                    {entry.suspensionStartDate ? (
                      <DetailField label="Suspension start">{formatDisplayDate(entry.suspensionStartDate)}</DetailField>
                    ) : null}
                    {entry.suspensionEndDate ? (
                      <DetailField label="Expected return">{formatDisplayDate(entry.suspensionEndDate)}</DetailField>
                    ) : null}
                    {entry.effectiveDate ? (
                      <DetailField label="Effective date">{formatDisplayDate(entry.effectiveDate)}</DetailField>
                    ) : null}
                    {entry.previousStatus ? (
                      <DetailField label="Previous status">{String(entry.previousStatus)}</DetailField>
                    ) : null}
                    {entry.newStatus ? (
                      <DetailField label="New status">{String(entry.newStatus)}</DetailField>
                    ) : null}
                    {entry.previousClass ? (
                      <DetailField label="Previous class">{entry.previousClass}</DetailField>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default TeacherStatusHistory;
