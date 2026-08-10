import React, { useEffect, useMemo, useState } from 'react';
import { BedDouble, CheckCircle2, Loader2, Settings2, UtensilsCrossed } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { boardingService, type BoardingTermFeeSetting } from '@/services/boardingService';
import BoardingFeeBreakdownDisplay, { boardingFeeBreakdownTotal } from './BoardingFeeBreakdownDisplay';

interface BoardingFeeSetupPanelProps {
  currentTerm: string;
  dialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
}

const formatMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const BoardingFeeSetupPanel: React.FC<BoardingFeeSetupPanelProps> = ({
  currentTerm,
  dialogOpen: dialogOpenProp,
  onDialogOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = dialogOpenProp ?? internalOpen;
  const setOpen = onDialogOpenChange ?? setInternalOpen;

  const [lodgingAmount, setLodgingAmount] = useState('');
  const [feedingAmount, setFeedingAmount] = useState('');
  const [feeMode, setFeeMode] = useState<'same' | 'by_gender'>('same');
  const [boysLodging, setBoysLodging] = useState('');
  const [boysFeeding, setBoysFeeding] = useState('');
  const [girlsLodging, setGirlsLodging] = useState('');
  const [girlsFeeding, setGirlsFeeding] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState<BoardingTermFeeSetting | null>(null);

  const previewTotal = useMemo(() => {
    const lodging = parseFloat(lodgingAmount) || 0;
    const feeding = parseFloat(feedingAmount) || 0;
    return Math.round((lodging + feeding) * 100) / 100;
  }, [lodgingAmount, feedingAmount]);

  const loadSetting = async () => {
    setLoading(true);
    try {
      const data = await boardingService.getTermBoardingFee();
      setSetting(data);
      if (data.is_configured) {
        setFeeMode(data.fee_mode === 'by_gender' ? 'by_gender' : 'same');
        setLodgingAmount(String(data.lodging_amount ?? data.amount ?? 0));
        setFeedingAmount(String(data.feeding_amount ?? 0));
        setBoysLodging(String(data.boys_lodging_amount ?? 0));
        setBoysFeeding(String(data.boys_feeding_amount ?? 0));
        setGirlsLodging(String(data.girls_lodging_amount ?? 0));
        setGirlsFeeding(String(data.girls_feeding_amount ?? 0));
      }
    } catch {
      setSetting(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSetting();
  }, [currentTerm]);

  const handleApply = async () => {
    const lodging = parseFloat(lodgingAmount) || 0;
    const feeding = parseFloat(feedingAmount) || 0;
    const bLodging = parseFloat(boysLodging) || 0;
    const bFeeding = parseFloat(boysFeeding) || 0;
    const gLodging = parseFloat(girlsLodging) || 0;
    const gFeeding = parseFloat(girlsFeeding) || 0;

    if (feeMode === 'same' && lodging <= 0 && feeding <= 0) {
      toast({
        title: 'Enter at least one amount',
        description: 'Set lodging, feeding, or both.',
        variant: 'destructive',
      });
      return;
    }
    if (feeMode === 'by_gender' && bLodging + bFeeding + gLodging + gFeeding <= 0) {
      toast({ title: 'Enter boys and/or girls fee amounts', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const saved = await boardingService.saveTermBoardingFee({
        lodging_amount: lodging,
        feeding_amount: feeding,
        fee_mode: feeMode,
        boys_lodging_amount: bLodging,
        boys_feeding_amount: bFeeding,
        girls_lodging_amount: gLodging,
        girls_feeding_amount: gFeeding,
      });
      setSetting(saved);
      setOpen(false);
      toast({
        title: 'Boarding fee saved',
        description: `GHS ${formatMoney(saved.amount)} total for ${currentTerm} (lodging + feeding).`,
      });
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const configuredBreakdown = setting?.is_configured
    ? {
        lodging: Number(setting.lodging_amount ?? setting.amount ?? 0),
        feeding: Number(setting.feeding_amount ?? 0),
      }
    : null;

  return (
    <>
      <Card
        id="boarding-fee-panel"
        className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm dark:from-emerald-950/20 dark:to-slate-900/40 dark:border-emerald-900/40 scroll-mt-4"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
        <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <BedDouble className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">Boarding fee</p>
              {loading ? (
                <Badge variant="secondary" className="border-0 text-[10px]">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />
                  Loading…
                </Badge>
              ) : setting?.is_configured ? (
                <Badge className="border-0 bg-emerald-100 text-emerald-800 text-[10px]">
                  GHS {formatMoney(setting.amount)} · {currentTerm}
                </Badge>
              ) : (
                <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800 text-[10px]">
                  Not set for this term
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Set <strong>lodging</strong> (hostel) and <strong>feeding</strong> separately for this term. Boarders
              receive both lines on their fee statement — day students do not.
            </p>
            {configuredBreakdown && boardingFeeBreakdownTotal(configuredBreakdown) > 0 ? (
              <div className="max-w-md rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-slate-900/30">
                <BoardingFeeBreakdownDisplay breakdown={configuredBreakdown} total={setting?.amount} compact />
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="primaryAction"
            className="rounded-xl shrink-0 w-full lg:w-auto"
            onClick={() => setOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Set boarding fee
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg border-t-4 border-emerald-500`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-emerald-600" />
              Boarding fee — {currentTerm}
            </DialogTitle>
            <DialogDescription>
              Break down the boarder charge into lodging and feeding. Both appear separately on the student&apos;s
              statement.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="flex items-center justify-between rounded-xl border p-3 bg-slate-50/80">
              <div>
                <p className="text-sm font-medium">Same fee for all boarders</p>
                <p className="text-xs text-muted-foreground">Turn off to set separate boys and girls fees</p>
              </div>
              <Switch
                checked={feeMode === 'same'}
                onCheckedChange={(checked) => setFeeMode(checked ? 'same' : 'by_gender')}
              />
            </div>

            {feeMode === 'same' ? (
            <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="boarding-lodging-amount" className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5" />
                  Lodging (GHS)
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">GHS</span>
                  <Input
                    id="boarding-lodging-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1200.00"
                    value={lodgingAmount}
                    onChange={(e) => setLodgingAmount(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="boarding-feeding-amount" className="inline-flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  Feeding (GHS)
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">GHS</span>
                  <Input
                    id="boarding-feeding-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 300.00"
                    value={feedingAmount}
                    onChange={(e) => setFeedingAmount(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {previewTotal > 0 ? (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80 mb-2">
                  Preview on statement
                </p>
                <BoardingFeeBreakdownDisplay
                  breakdown={{
                    lodging: parseFloat(lodgingAmount) || 0,
                    feeding: parseFloat(feedingAmount) || 0,
                  }}
                  total={previewTotal}
                />
              </div>
            ) : null}
            </>
            ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-3 space-y-3">
                <p className="text-sm font-semibold text-sky-900">Boys</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="boys-lodging">Lodging (GHS)</Label>
                    <Input id="boys-lodging" type="number" min="0" step="0.01" value={boysLodging} onChange={(e) => setBoysLodging(e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>
                  <div>
                    <Label htmlFor="boys-feeding">Feeding (GHS)</Label>
                    <Input id="boys-feeding" type="number" min="0" step="0.01" value={boysFeeding} onChange={(e) => setBoysFeeding(e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-pink-200/80 bg-pink-50/40 p-3 space-y-3">
                <p className="text-sm font-semibold text-pink-900">Girls</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="girls-lodging">Lodging (GHS)</Label>
                    <Input id="girls-lodging" type="number" min="0" step="0.01" value={girlsLodging} onChange={(e) => setGirlsLodging(e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>
                  <div>
                    <Label htmlFor="girls-feeding">Feeding (GHS)</Label>
                    <Input id="girls-feeding" type="number" min="0" step="0.01" value={girlsFeeding} onChange={(e) => setGirlsFeeding(e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 space-y-1.5">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                Lodging and feeding show as separate lines under Boarding
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                Does not change class fee structures below
              </p>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => void handleApply()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save boarding fee'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BoardingFeeSetupPanel;
