import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { apiService } from '../../services/api';

export type TermClosePreview = {
  termLabel: string;
  nextTermLabel: string | null;
  totalActiveStudents: number;
  totalStudentsWithBilling: number;
  totalFeesBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalCredits: number;
  canClose: boolean;
  closeBlockReason: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicTermId: string;
  onClosed: (result: { closedTermLabel: string; nextTermLabel: string | null }) => void;
};

const money = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CloseTermModal({ open, onOpenChange, academicTermId, onClosed }: Props) {
  const [preview, setPreview] = useState<TermClosePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !academicTermId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    void apiService
      .get<TermClosePreview>(`/academic-terms/${academicTermId}/close-preview`)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setPreview(null);
          setError(err.message || 'Failed to load close summary');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, academicTermId]);

  const handleClose = async () => {
    if (!academicTermId || !preview?.canClose) return;
    setClosing(true);
    setError(null);
    try {
      const result = await apiService.post<{
        success: boolean;
        closedTermLabel: string;
        nextTermLabel: string | null;
        error?: string;
      }>(`/academic-terms/${academicTermId}/close`, {});
      if (!result.success) {
        throw new Error(result.error || 'Failed to close term');
      }
      onClosed({
        closedTermLabel: result.closedTermLabel,
        nextTermLabel: result.nextTermLabel,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close term');
    } finally {
      setClosing(false);
    }
  };

  const canSubmit = !!preview?.canClose && !loading && !closing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="readonly-view-allow max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-600" />
            Close Term Permanently
          </DialogTitle>
          <DialogDescription>
            This creates an immutable snapshot and locks the term forever. Carry-forward entries will be created for the next term.
          </DialogDescription>
        </DialogHeader>

        <div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading term summary…
            </div>
          ) : error && !preview ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : preview ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p>
                  <span className="font-medium">Term being closed:</span> {preview.termLabel}
                </p>
                <p>
                  <span className="font-medium">Next term:</span>{' '}
                  {preview.nextTermLabel || '— create next term first'}
                </p>
                <p>
                  <span className="font-medium">Active students in system:</span>{' '}
                  {preview.totalActiveStudents}
                  {preview.totalStudentsWithBilling > 0 ? (
                    <span className="text-muted-foreground">
                      {' '}
                      ({preview.totalStudentsWithBilling} with fee activity this term)
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <p className="font-medium">Term finance summary</p>
                <p>
                  <span className="text-muted-foreground">Total fees billed:</span>{' '}
                  {money(preview.totalFeesBilled)}
                </p>
                <p>
                  <span className="text-muted-foreground">Total collected:</span>{' '}
                  {money(preview.totalCollected)}
                </p>
                <p>
                  <span className="text-muted-foreground">Total outstanding:</span>{' '}
                  {money(preview.totalOutstanding)}
                </p>
                <p>
                  <span className="text-muted-foreground">Total credits:</span>{' '}
                  {money(preview.totalCredits)}
                </p>
              </div>

              {!preview.canClose && preview.closeBlockReason ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm">
                  {preview.closeBlockReason}
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  This action is <strong>permanent and cannot be undone</strong>. The term will be locked forever. No payments, corrections, or edits will ever be allowed for this term.
                </p>
              </div>
              {error ? <p className="text-red-600 text-sm">{error}</p> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-readonly-allow="view"
            onClick={() => onOpenChange(false)}
            disabled={closing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-readonly-allow="view"
            onClick={() => void handleClose()}
            disabled={!canSubmit}
          >
            {closing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing…
              </>
            ) : (
              'Close Term Permanently'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CloseTermModal;
