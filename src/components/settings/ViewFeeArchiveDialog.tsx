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
import { Archive, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import type { ClosedTermRecord } from './ViewClosedTermModal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicTermId: string | null;
};

const money = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ViewFeeArchiveDialog({ open, onOpenChange, academicTermId }: Props) {
  const [record, setRecord] = useState<ClosedTermRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !academicTermId) {
      setRecord(null);
      setError(null);
      setExpandedClassId(null);
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
          setError(err.message || 'Failed to load fee archive');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, academicTermId]);

  const archive = record?.feeArchive;
  const structures = archive?.structures ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} readonly-view-allow`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-slate-600" />
            Archived fee structures
          </DialogTitle>
          <DialogDescription>
            {record?.termLabel
              ? `Fee structures saved when ${record.termLabel} was closed. Reuse them from Set Fees on the active term.`
              : 'Fee structures archived at term close.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-3 text-sm`}>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading archive…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
          ) : !archive || structures.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              No fee structures were archived for this term.
            </p>
          ) : (
            <div className="space-y-2 max-h-[min(60vh,28rem)] overflow-y-auto rounded-lg border border-border p-2">
              {structures.map((row) => {
                const openRow = expandedClassId === row.class_id;
                return (
                  <div key={row.class_id} className="rounded-lg border border-border/60 bg-muted/10">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30"
                      onClick={() => setExpandedClassId(openRow ? null : row.class_id)}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {openRow ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">
                          {row.class_name}
                          {row.level ? ` · ${row.level}` : ''}
                        </span>
                      </span>
                      <span className="font-semibold shrink-0">{money(row.total)}</span>
                    </button>
                    {openRow ? (
                      <ul className="border-t border-border/50 px-3 py-2 space-y-1 text-xs">
                        {row.items.map((item, idx) => (
                          <li key={`${item.item_name}-${idx}`} className="flex justify-between gap-2">
                            <span className={item.is_active === false ? 'text-muted-foreground line-through' : ''}>
                              {item.item_name}
                            </span>
                            <span>{money(item.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ViewFeeArchiveDialog;
