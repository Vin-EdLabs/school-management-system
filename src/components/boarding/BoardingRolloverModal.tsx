import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { boardingService } from '@/services/boardingService';
import { apiService } from '@/services/api';

type TermOption = { id: number; name: string; year_name?: string; is_current?: boolean };

interface BoardingRolloverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boarderCount?: number;
  onComplete?: () => void;
}

export const BoardingRolloverModal: React.FC<BoardingRolloverModalProps> = ({
  open,
  onOpenChange,
  boarderCount = 0,
  onComplete,
}) => {
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [fromTermId, setFromTermId] = useState('');
  const [toTermId, setToTermId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiService
      .get('/terms')
      .then((rows: TermOption[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setTerms(list);
        const current = list.find((t) => t.is_current);
        if (current) setFromTermId(String(current.id));
        const next = list.find((t) => !t.is_current && Number(t.id) > Number(current?.id || 0));
        if (next) setToTermId(String(next.id));
      })
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, [open]);

  const fromTerm = terms.find((t) => String(t.id) === fromTermId);
  const toTerm = terms.find((t) => String(t.id) === toTermId);

  const confirm = async () => {
    if (!fromTermId || !toTermId) {
      toast({ title: 'Select both terms', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await boardingService.rolloverBoarders(parseInt(fromTermId, 10), parseInt(toTermId, 10));
      toast({
        title: 'Rollover complete',
        description: `${result.students_carried} boarders carried forward.`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (e) {
      toast({ title: 'Rollover failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogContentClass}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            Roll over boarders
          </DialogTitle>
          <DialogDescription>
            Roll over {boarderCount} boarder{boarderCount === 1 ? '' : 's'} to the new term. Bed assignments are preserved and boarding fees for the new term are applied automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={detailDialogBodyClass}>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
          ) : (
            <>
              <div>
                <Label>From term</Label>
                <Select value={fromTermId} onValueChange={setFromTermId}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year_name ? `(${t.year_name})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To term</Label>
                <Select value={toTermId} onValueChange={setToTermId}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {terms.filter((t) => String(t.id) !== fromTermId).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year_name ? `(${t.year_name})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {fromTerm && toTerm ? (
                <p className="text-sm text-muted-foreground rounded-xl bg-emerald-50/60 p-3 border border-emerald-100">
                  Confirm rollover from <strong>{fromTerm.name}</strong> to <strong>{toTerm.name}</strong>?
                </p>
              ) : null}
            </>
          )}
        </DialogBody>
        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primaryAction" className="rounded-xl" disabled={saving || loading} onClick={() => void confirm()}>
            {saving ? 'Rolling over…' : 'Confirm rollover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BoardingRolloverModal;
