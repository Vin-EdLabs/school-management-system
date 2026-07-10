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
import {
  copyFeeStructuresFromTerm,
  fetchFeeStructureCopySourceDetail,
  fetchFeeStructureCopySources,
  reuseArchivedFeeStructure,
  type FeeStructureCopySource,
} from '../../services/feeStructureItems';
import { useActiveTerm } from '../../hooks/useActiveTerm';

type Props = {
  currentTerm: string;
  onReused: () => void | Promise<void>;
};

const money = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function sourceKey(s: FeeStructureCopySource) {
  return `${s.sourceType}:${s.id}`;
}

const ArchivedFeeStructurePanel: React.FC<Props> = ({ currentTerm, onReused }) => {
  const queryClient = useQueryClient();
  const { activeLedgerTermId } = useActiveTerm();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmReuseOpen, setConfirmReuseOpen] = useState(false);
  const [confirmBillOpen, setConfirmBillOpen] = useState(false);
  const [reusing, setReusing] = useState(false);

  const {
    data: sources = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['fee-structure-copy-sources', activeLedgerTermId],
    queryFn: fetchFeeStructureCopySources,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (sources.length === 0) {
      setSelectedKey('');
      return;
    }
    if (!selectedKey || !sources.some((s) => sourceKey(s) === selectedKey)) {
      setSelectedKey(sourceKey(sources[0]));
    }
  }, [sources, selectedKey]);

  const selectedSource = useMemo(
    () => sources.find((s) => sourceKey(s) === selectedKey) ?? null,
    [sources, selectedKey]
  );

  const { data: selectedDetail, isLoading: detailLoading } = useQuery({
    queryKey: [
      'fee-structure-copy-source',
      selectedSource?.sourceType,
      selectedSource?.id,
    ],
    queryFn: () =>
      fetchFeeStructureCopySourceDetail(selectedSource!.sourceType, selectedSource!.id),
    enabled: !!selectedSource,
    staleTime: 60 * 1000,
  });

  const displayStructures = selectedDetail?.structures ?? [];
  const displayLabel = selectedDetail?.termLabel ?? selectedSource?.termLabel ?? '—';
  const displayCount =
    selectedDetail?.structureCount ?? selectedSource?.structureCount ?? 0;

  const runReuse = async (billStudents: boolean) => {
    if (!selectedSource) return;
    setReusing(true);
    try {
      const result =
        selectedSource.sourceType === 'archive'
          ? await reuseArchivedFeeStructure(selectedSource.id, {
              termId: activeLedgerTermId ?? undefined,
              billStudents,
            })
          : await copyFeeStructuresFromTerm(selectedSource.ledgerTermId, {
              termId: activeLedgerTermId ?? undefined,
              billStudents,
            });

      void queryClient.invalidateQueries({ queryKey: ['fee-structure-check'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-copy-sources'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-archives'] });
      await onReused();
      setConfirmReuseOpen(false);
      setConfirmBillOpen(false);
      toast({
        title: billStudents ? 'Fee structures copied and billed' : 'Fee structures copied',
        description: result.message,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to copy previous fee setup';
      toast({ title: 'Copy failed', description: message, variant: 'destructive' });
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
            Reuse previous term fee setup
          </CardTitle>
          <p className="text-sm text-muted-foreground pl-[2.75rem]">
            Select a previous term that already has fee structures, review the classes, then copy them into{' '}
            <span className="font-semibold text-foreground">{currentTerm}</span>.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading previous fee setups…
            </div>
          ) : isError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700 dark:text-red-400">Could not load previous fee setups.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No previous term fee setups found. Set fees on a term first, or close a term that already has fee
              structures — then you can reuse them here after switching.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-w-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                  Select previous term
                </p>
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className="bg-background/90">
                    <SelectValue placeholder="Choose previous term fee setup" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((row) => (
                      <SelectItem key={sourceKey(row)} value={sourceKey(row)}>
                        {row.termLabel}
                        {row.structureCount
                          ? ` · ${row.structureCount} class${row.structureCount === 1 ? '' : 'es'}`
                          : ''}
                        {row.status === 'closed' ? ' · closed' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSource ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{displayCount}</span> class
                    {displayCount === 1 ? '' : 'es'} from{' '}
                    <span className="font-semibold text-foreground">{displayLabel}</span>
                    {detailLoading ? ' · loading…' : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={!displayCount}
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
                      disabled={!displayCount}
                      onClick={() => setConfirmReuseOpen(true)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Use for {currentTerm}
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
                <DialogTitle>Previous term fee structures</DialogTitle>
                <DialogDescription className="mt-1.5">
                  {displayLabel} — review before copying into {currentTerm}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
            {detailLoading && displayStructures.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : displayStructures.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No class structures in this setup.</p>
            ) : (
              displayStructures.map((row) => (
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
                <DialogTitle>Copy previous fee setup?</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Copy fee structures into the active term. Students are not billed unless you choose copy &amp; bill.
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Previous term
                  </p>
                  <p className="mt-0.5 font-semibold text-foreground truncate">{displayLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {displayCount} class{displayCount === 1 ? '' : 'es'}
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
                  <p className="text-xs text-muted-foreground mt-0.5">Structures only — no billing</p>
                </div>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Each class fee structure is copied into the active term.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Classes that already have fees for this term are skipped.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>Students are not billed automatically unless you choose Copy &amp; bill.</span>
              </li>
            </ul>
          </DialogBody>

          <DialogFooter className={`${detailDialogFooterClass} flex-col gap-2 sm:flex-col`}>
            <Button
              type="button"
              variant="primaryAction"
              className="w-full"
              disabled={reusing}
              onClick={() => void runReuse(false)}
            >
              {reusing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying structures…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Copy structures only
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={reusing}
              onClick={() => {
                setConfirmReuseOpen(false);
                setConfirmBillOpen(true);
              }}
            >
              Copy &amp; bill students…
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmReuseOpen(false)}
              disabled={reusing}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBillOpen} onOpenChange={(open) => !reusing && setConfirmBillOpen(open)}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Copy and bill students?</DialogTitle>
            <DialogDescription className="mt-1.5">
              Copy structures from {displayLabel} and post term fees to enrolled students in those classes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={`${detailDialogFooterClass} flex-col gap-2 sm:flex-col`}>
            <Button
              type="button"
              variant="primaryAction"
              className="w-full"
              disabled={reusing}
              onClick={() => void runReuse(true)}
            >
              {reusing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying &amp; billing…
                </>
              ) : (
                'Copy & bill students'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmBillOpen(false)}
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
