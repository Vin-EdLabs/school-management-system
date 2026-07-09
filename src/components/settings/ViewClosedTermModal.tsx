import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Archive, Loader2, Lock } from 'lucide-react';
import { apiService } from '../../services/api';
import { formatDisplayDate } from '../../utils/dateFormat';
import ViewFeeArchiveDialog from './ViewFeeArchiveDialog';

export type ClosedTermRecord = {
  academicTermId: number;
  termName: string;
  year: string;
  termLabel: string;
  startDate: string | null;
  endDate: string | null;
  closedAt: string | null;
  isClosed: boolean;
  snapshot: {
    totalStudents: number;
    totalFeesBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalCredits: number;
    createdAt: string;
  } | null;
  feeArchive: {
    structureCount: number;
    structures: Array<{
      class_id: number;
      class_name: string;
      level: string | null;
      total: number;
      items: Array<{ item_name: string; amount: number; is_active: boolean }>;
    }>;
  } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicTermId: string | null;
  onBrowseReadOnly: (termLabel: string) => void;
};

const money = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ViewClosedTermModal({ open, onOpenChange, academicTermId, onBrowseReadOnly }: Props) {
  const [record, setRecord] = useState<ClosedTermRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    if (!open || !academicTermId) {
      setRecord(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiService
      .get<ClosedTermRecord>(`/academic-terms/${academicTermId}/closed-record`)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setRecord(null);
          setError(err.message || 'Failed to load closed term');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, academicTermId]);

  const handleBrowse = () => {
    if (!record) return;
    onBrowseReadOnly(record.termLabel);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} readonly-view-allow`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Closed term — view only
          </DialogTitle>
          <DialogDescription>
            This term is permanently closed. You can browse records read-only without changing the active term.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-4 text-sm`}>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading closed term…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
          ) : record ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-1 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="font-semibold text-lg">{record.termLabel}</p>
                {record.startDate && record.endDate ? (
                  <p className="text-muted-foreground">
                    {formatDisplayDate(record.startDate)} – {formatDisplayDate(record.endDate)}
                  </p>
                ) : null}
                {record.closedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Closed {formatDisplayDate(record.closedAt.split('T')[0])}
                  </p>
                ) : null}
              </div>

              {record.snapshot ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                  <p className="font-medium">Finance snapshot at close</p>
                  <p>
                    <span className="text-muted-foreground">Students:</span> {record.snapshot.totalStudents}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Fees billed:</span>{' '}
                    {money(record.snapshot.totalFeesBilled)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Collected:</span>{' '}
                    {money(record.snapshot.totalCollected)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Outstanding:</span>{' '}
                    {money(record.snapshot.totalOutstanding)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Credits carried:</span>{' '}
                    {money(record.snapshot.totalCredits)}
                  </p>
                </div>
              ) : null}

              {record.feeArchive && record.feeArchive.structureCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      Archived fee structures ({record.feeArchive.structureCount} classes)
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setArchiveOpen(true)}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      View archive
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-border p-2">
                    {record.feeArchive.structures.map((row) => (
                      <div
                        key={row.class_id}
                        className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <span>
                          {row.class_name}
                          {row.level ? ` · ${row.level}` : ''}
                        </span>
                        <span className="font-medium shrink-0">{money(row.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {record?.feeArchive && record.feeArchive.structureCount > 0 ? (
            <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)} disabled={loading}>
              <Archive className="mr-2 h-4 w-4" />
              View from archive
            </Button>
          ) : null}
          <Button onClick={handleBrowse} disabled={!record || loading}>
            <Eye className="mr-2 h-4 w-4" />
            Browse all pages
          </Button>
        </DialogFooter>
      </DialogContent>
      <ViewFeeArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        academicTermId={academicTermId}
      />
    </Dialog>
  );
}

export default ViewClosedTermModal;
