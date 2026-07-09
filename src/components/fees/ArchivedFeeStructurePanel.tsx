import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentClass,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { Archive, ArrowRight, Eye, Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { feeStructureCheckKey } from '../../hooks/useFeeStructureCheck';
import {
  fetchFeeStructureArchive,
  fetchFeeStructureArchives,
  reuseArchivedFeeStructure,
  type FeeStructureArchive,
} from '../../services/feeStructureItems';

type Props = {
  currentTerm: string;
  onReused: () => void | Promise<void>;
};

const money = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ArchivedFeeStructurePanel: React.FC<Props> = ({ currentTerm, onReused }) => {
  const queryClient = useQueryClient();
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmReuseOpen, setConfirmReuseOpen] = useState(false);
  const [reusing, setReusing] = useState(false);

  const {
    data: archives = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['fee-structure-archives'],
    queryFn: fetchFeeStructureArchives,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (archives.length === 0) {
      setSelectedArchiveId('');
      return;
    }
    if (!selectedArchiveId || !archives.some((a) => String(a.id) === selectedArchiveId)) {
      setSelectedArchiveId(String(archives[0].id));
    }
  }, [archives, selectedArchiveId]);

  const selectedIdNum = selectedArchiveId ? parseInt(selectedArchiveId, 10) : NaN;

  const { data: selectedArchive, isLoading: detailLoading } = useQuery({
    queryKey: ['fee-structure-archive', selectedIdNum],
    queryFn: () => fetchFeeStructureArchive(selectedIdNum),
    enabled: Number.isFinite(selectedIdNum) && selectedIdNum > 0,
    staleTime: 60 * 1000,
  });

  const listArchive = useMemo(
    () => archives.find((a) => a.id === selectedIdNum) ?? null,
    [archives, selectedIdNum]
  );

  const displayArchive: FeeStructureArchive | null = selectedArchive ?? listArchive;

  const handleReuse = async () => {
    if (!Number.isFinite(selectedIdNum)) return;
    setReusing(true);
    try {
      const result = await reuseArchivedFeeStructure(selectedIdNum);
      void queryClient.invalidateQueries({ queryKey: feeStructureCheckKey() });
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-archives'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-archive', selectedIdNum] });
      await onReused();
      setConfirmReuseOpen(false);
      toast({
        title: 'Fee structures reused',
        description: result.message,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reuse archived fees';
      toast({ title: 'Reuse failed', description: message, variant: 'destructive' });
    } finally {
      setReusing(false);
    }
  };

  return (
    <>
      <Card className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-slate-50/50 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/25 dark:via-slate-950 dark:to-slate-950/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-950 dark:text-emerald-100">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800">
              <Archive className="h-4 w-4" />
            </span>
            Reuse fees from archive
          </CardTitle>
          <p className="text-sm text-muted-foreground pl-[2.75rem]">
            Fee structures saved when a term was closed. Select an archive, review it, then reuse for the active term.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading archives…
            </div>
          ) : isError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700 dark:text-red-400">Could not load fee archives.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No archived fee structures yet. Archives are created automatically when you close a term that has fee structures set.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-w-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                  Select archived term
                </p>
                <Select value={selectedArchiveId} onValueChange={setSelectedArchiveId}>
                  <SelectTrigger className="bg-background/90">
                    <SelectValue placeholder="Choose archived term" />
                  </SelectTrigger>
                  <SelectContent>
                    {archives.map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.term_label}
                        {row.structure_count
                          ? ` · ${row.structure_count} class${row.structure_count === 1 ? '' : 'es'}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {displayArchive ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{displayArchive.structure_count}</span>{' '}
                    class{displayArchive.structure_count === 1 ? '' : 'es'} from{' '}
                    <span className="font-semibold text-foreground">{displayArchive.term_label}</span>
                    {detailLoading ? ' · loading…' : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={!displayArchive.structure_count}
                      onClick={() => setViewOpen(true)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="primaryAction"
                      size="sm"
                      className="h-9"
                      disabled={!displayArchive.structure_count}
                      onClick={() => setConfirmReuseOpen(true)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reuse for {currentTerm}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className={`${detailDialogContentWideClass} readonly-view-allow`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
                <Archive className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle>Archived fee structures</DialogTitle>
                <DialogDescription className="mt-1.5">
                  {displayArchive?.term_label ?? 'Archive'} — read-only snapshot from term close.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
            {detailLoading && !selectedArchive?.structures?.length ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : (displayArchive?.structures || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No class structures in this archive.</p>
            ) : (
              (displayArchive?.structures || []).map((row) => (
                <div key={row.class_id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.class_name}</p>
                      {row.level ? <p className="text-xs text-muted-foreground">{row.level}</p> : null}
                    </div>
                    <p className="font-semibold text-foreground">{money(row.total)}</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {row.items
                      .filter((i) => i.is_active && Number(i.amount) > 0)
                      .map((item) => (
                        <li key={item.item_name} className="flex justify-between gap-4">
                          <span>{item.item_name}</span>
                          <span>{money(Number(item.amount))}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReuseOpen} onOpenChange={(open) => !reusing && setConfirmReuseOpen(open)}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
                <RotateCcw className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle>Reuse archived fees?</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Copy fee structures into the active term and bill students — same result as entering each class manually.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800/75 dark:text-emerald-300/80 mb-3">
                Copy from → apply to
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Archive</p>
                  <p className="mt-0.5 font-semibold text-foreground truncate">
                    {displayArchive?.term_label ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {displayArchive?.structure_count ?? 0} class
                    {(displayArchive?.structure_count ?? 0) === 1 ? '' : 'es'}
                  </p>
                </div>
                <ArrowRight className="hidden sm:block h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <div className="min-w-0 flex-1 rounded-lg border border-emerald-300/60 bg-emerald-100/40 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
                    Active term
                  </p>
                  <p className="mt-0.5 font-semibold text-emerald-950 dark:text-emerald-100 truncate">
                    {currentTerm}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Students will be billed</p>
                </div>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Each class fee structure is copied from the archive.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Classes that already have fees for this term are skipped.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>This cannot be undone automatically — review the archive with View first if needed.</span>
              </li>
            </ul>
          </DialogBody>

          <DialogFooter className={`${detailDialogFooterClass} flex-col gap-2 sm:flex-col`}>
            <Button
              type="button"
              variant="primaryAction"
              className="w-full"
              disabled={reusing}
              onClick={() => void handleReuse()}
            >
              {reusing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reusing & billing students…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reuse & bill students
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmReuseOpen(false)}
              disabled={reusing}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ArchivedFeeStructurePanel;
