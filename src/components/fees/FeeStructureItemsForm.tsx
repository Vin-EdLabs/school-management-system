import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, Pin } from 'lucide-react';
import {
  computeItemsTotal,
  buildActiveItemsLabel,
  fetchFeeStructureItems,
  formatFeeItemLabel,
  DEFAULT_FEE_STRUCTURE_ITEMS,
  type FeeStructureItem,
} from '../../services/feeStructureItems';

export type FeeStructureItemsFormProps = {
  feeStructureId?: string | null;
  classLabel: string;
  termLabel: string;
  yearLabel?: string;
  onItemsChange?: (items: FeeStructureItem[], total: number) => void;
  fieldErrors?: Record<number, string>;
};

const normalizeItems = (items: FeeStructureItem[]): FeeStructureItem[] =>
  items.map((item, index) => ({
    ...item,
    amount: item.is_active
      ? item.amount == null || Number.isNaN(Number(item.amount))
        ? null
        : Number(item.amount)
      : null,
    sort_order: item.sort_order ?? index + 1,
    is_required: item.is_required ?? item.item_name.trim().toLowerCase() === 'tuition',
  }));

const amountInputValue = (amount: number | null | undefined) =>
  amount == null || Number.isNaN(Number(amount)) ? '' : amount;

const parseAmountInput = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
};

export const FeeStructureItemsForm: React.FC<FeeStructureItemsFormProps> = ({
  feeStructureId,
  classLabel,
  termLabel,
  yearLabel,
  onItemsChange,
  fieldErrors,
}) => {
  const [items, setItems] = useState<FeeStructureItem[]>(DEFAULT_FEE_STRUCTURE_ITEMS);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (fieldErrors) setErrors(fieldErrors);
  }, [fieldErrors]);

  useEffect(() => {
    if (!feeStructureId) {
      setItems(DEFAULT_FEE_STRUCTURE_ITEMS);
      setErrors({});
      return;
    }
    setLoading(true);
    void fetchFeeStructureItems(feeStructureId)
      .then(data => setItems(normalizeItems(data)))
      .catch(() => setItems(DEFAULT_FEE_STRUCTURE_ITEMS))
      .finally(() => setLoading(false));
  }, [feeStructureId]);

  const total = useMemo(() => computeItemsTotal(items), [items]);
  const activeLabel = useMemo(() => buildActiveItemsLabel(items), [items]);

  useEffect(() => {
    onItemsChange?.(items, total);
  }, [items, total, onItemsChange]);

  const updateItem = (index: number, patch: Partial<FeeStructureItem>) => {
    setItems(prev => {
      const next = [...prev];
      const current = next[index];
      const isRequired = current.is_required || current.item_name.trim().toLowerCase() === 'tuition';
      if (isRequired) {
        next[index] = { ...current, ...patch, is_active: true };
      } else {
        const isActive = patch.is_active ?? current.is_active;
        next[index] = {
          ...current,
          ...patch,
          is_active: isActive,
          amount: isActive
            ? patch.amount !== undefined
              ? patch.amount
              : current.amount
            : null,
        };
      }
      return next;
    });
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading fee items…
      </div>
    );
  }

  const requiredItems = items.filter(i => i.is_required || i.item_name.trim().toLowerCase() === 'tuition');
  const optionalItems = items.filter(i => !(i.is_required || i.item_name.trim().toLowerCase() === 'tuition'));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          Fee Structure Setup
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {classLabel} · {termLabel}{yearLabel ? ` · ${yearLabel}` : ''}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Required</p>
        {requiredItems.map(item => {
          const index = items.findIndex(i => i.item_name === item.item_name);
          return (
            <div key={item.item_name} className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
              <div className="flex items-start gap-3">
                <Pin className="h-4 w-4 text-emerald-600 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{formatFeeItemLabel(item.item_name)}</p>
                      <p className="text-xs text-muted-foreground">Required — use GHS 0.00 if this class has no fees (e.g. Creche)</p>
                    </div>
                    <div className="flex items-center gap-2 sm:w-44">
                      <Label className="text-xs text-muted-foreground shrink-0">GHS</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amountInputValue(item.amount)}
                        onChange={e => updateItem(index, { amount: parseAmountInput(e.target.value) })}
                        className="h-10"
                      />
                    </div>
                  </div>
                  {errors[index] && <p className="mt-2 text-xs text-red-600">{errors[index]}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Optional fees</p>
          <p className="text-xs text-muted-foreground mt-1">Toggle on to include in this term&apos;s bill</p>
        </div>
        {optionalItems.map(item => {
          const index = items.findIndex(i => i.item_name === item.item_name);
          return (
            <div
              key={item.item_name}
              className={`rounded-xl border p-4 transition-colors ${item.is_active ? 'border-border bg-card' : 'border-border/60 bg-muted/20 opacity-80'}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={item.is_active} onCheckedChange={checked => updateItem(index, { is_active: checked })} />
                  <div>
                    <p className="font-medium text-foreground">{formatFeeItemLabel(item.item_name)}</p>
                    {!item.is_active && <p className="text-xs text-muted-foreground">Not included this term</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:w-44">
                  <Label className="text-xs text-muted-foreground shrink-0">GHS</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={!item.is_active}
                    value={item.is_active ? amountInputValue(item.amount) : ''}
                    onChange={e => updateItem(index, { amount: parseAmountInput(e.target.value) })}
                    className="h-10"
                  />
                </div>
              </div>
              {errors[index] && <p className="mt-2 text-xs text-red-600">{errors[index]}</p>}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-950">Total Term Bill</p>
            {activeLabel ? (
              <p className="text-xs text-emerald-800/80 mt-0.5">{activeLabel}</p>
            ) : total <= 0 ? (
              <p className="text-xs text-emerald-800/80 mt-0.5">No fee charged for this class</p>
            ) : (
              <p className="text-xs text-emerald-800/80 mt-0.5">Add tuition to calculate total</p>
            )}
          </div>
          <Badge className="text-base px-3 py-1 bg-emerald-700 hover:bg-emerald-700">
            GHS {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export function validateFeeStructureItemsForm(items: FeeStructureItem[]): Record<number, string> {
  const nextErrors: Record<number, string> = {};
  items.forEach((item, index) => {
    const isTuition = item.item_name.trim().toLowerCase() === 'tuition';
    const amount = item.amount == null ? NaN : Number(item.amount);
    if (isTuition) {
      if (!item.is_active) {
        nextErrors[index] = 'Tuition is required';
      } else if (Number.isNaN(amount) || amount < 0) {
        nextErrors[index] = 'Enter a valid amount (0 or more)';
      }
    } else if (item.is_active && (Number.isNaN(amount) || amount <= 0)) {
      nextErrors[index] = 'Enter an amount greater than 0';
    } else if (item.is_active && amount < 0) {
      nextErrors[index] = 'Amount cannot be negative';
    }
  });
  return nextErrors;
}

export default FeeStructureItemsForm;
