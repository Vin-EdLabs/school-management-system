import React, { useEffect, useState } from 'react';
import { BedDouble, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { toggleSuperAdminBoarding } from '@/services/boardingService';

interface SuperAdminBoardingToggleProps {
  schoolId: number;
  schoolName: string;
  boardingEnabled: boolean;
  onUpdated?: (enabled: boolean) => void;
}

export default function SuperAdminBoardingToggle({
  schoolId,
  schoolName,
  boardingEnabled: initialEnabled,
  onUpdated,
}: SuperAdminBoardingToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled, schoolId]);

  const applyToggle = async (next: boolean) => {
    const prev = enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const result = await toggleSuperAdminBoarding(schoolId, next);
      const saved = Boolean(result.boarding_enabled);
      setEnabled(saved);
      onUpdated?.(saved);
      toast({
        title: saved ? 'Boarding enabled' : 'Boarding disabled',
        description: schoolName,
      });
    } catch (e) {
      setEnabled(prev);
      toast({
        title: 'Update failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
      setPendingValue(null);
    }
  };

  const handleSwitchChange = (next: boolean) => {
    if (next === enabled) return;
    setPendingValue(next);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingValue === null) return;
    void applyToggle(pendingValue);
  };

  const isEnableConfirm = pendingValue === true;
  const isDisableConfirm = pendingValue === false;

  return (
    <>
      <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900/40 dark:border-emerald-900/40 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-emerald-600" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Boarding module
              </p>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              Dorms, boarders & hostel operations
            </p>
          </div>
          <Badge
            className={cn(
              'border-0 shrink-0',
              enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            )}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable boarding for this school</p>
            <p className="text-xs text-slate-500">
              When off, school staff cannot access dormitories, roll call, exeats, or related features.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            <Switch checked={enabled} onCheckedChange={handleSwitchChange} disabled={saving} />
          </div>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setConfirmOpen(open);
            if (!open) setPendingValue(null);
          }
        }}
      >
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="text-slate-900 dark:text-white">
              {isEnableConfirm ? 'Enable Boarding Module?' : 'Disable Boarding Module?'}
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {isDisableConfirm
                ? `This will hide all boarding features from ${schoolName}'s dashboard. No data will be deleted — boarding can be re-enabled at any time.`
                : isEnableConfirm
                  ? `This will activate the boarding module for ${schoolName}. Any previously configured boarding data will be restored.`
                  : null}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={detailDialogBodyClass} />
          <DialogFooter className={detailDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setConfirmOpen(false);
                setPendingValue(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isDisableConfirm ? 'destructive' : 'default'}
              disabled={saving}
              onClick={handleConfirm}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDisableConfirm ? (
                'Disable Boarding'
              ) : (
                'Enable Boarding'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
