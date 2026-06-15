import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBudgetCategories } from '../../hooks/useBudgetCategories';
import { addBudgetCategory } from '../../services/termBudgetApi';
import {
  getDefaultCategories,
  HIDDEN_INCOME_CATEGORY_KEYS,
  OTHER_CATEGORY,
} from '../../constants/financeCategories';

const OTHER_VALUE = '__other__';

type BudgetCategorySelectProps = {
  type: 'income' | 'expense';
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
};

function normalizeKey(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function buildOptions(type: 'income' | 'expense', categoryNames: string[]): string[] {
  const defaults = getDefaultCategories(type);
  const defaultKeys = new Set(defaults.map(normalizeKey));

  const custom = categoryNames.filter((name) => {
    const key = normalizeKey(name);
    if (!key || key === normalizeKey(OTHER_CATEGORY)) return false;
    if (defaultKeys.has(key)) return false;
    if (type === 'income' && HIDDEN_INCOME_CATEGORY_KEYS.has(key)) return false;
    return true;
  });

  const standard = defaults.filter((d) => d !== OTHER_CATEGORY);
  return [...standard, ...Array.from(new Set(custom)).sort((a, b) => a.localeCompare(b)), OTHER_CATEGORY];
}

const BudgetCategorySelect: React.FC<BudgetCategorySelectProps> = ({
  type,
  value,
  onChange,
  label,
  disabled,
  id,
}) => {
  const { categoryNames } = useBudgetCategories(type);
  const options = useMemo(() => buildOptions(type, categoryNames), [type, categoryNames]);

  const valueInList = !!value && options.some((o) => normalizeKey(o) === normalizeKey(value));

  const [mode, setMode] = useState<'select' | 'other'>(() => {
    if (value && !options.some((o) => normalizeKey(o) === normalizeKey(value))) return 'other';
    return 'select';
  });
  const [otherName, setOtherName] = useState(() => {
    if (value && !options.some((o) => normalizeKey(o) === normalizeKey(value))) return value;
    return '';
  });

  const handleSelect = (selected: string) => {
    if (selected === OTHER_VALUE) {
      setMode('other');
      setOtherName('');
      onChange('');
      return;
    }
    setMode('select');
    setOtherName('');
    onChange(selected);
  };

  const handleOtherNameChange = (name: string) => {
    setOtherName(name);
    onChange(name);
  };

  const handleBackToList = () => {
    setMode('select');
    setOtherName('');
    onChange('');
  };

  const selectValue =
    mode === 'select' && value && valueInList
      ? options.find((o) => normalizeKey(o) === normalizeKey(value))!
      : undefined;

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      {mode === 'select' ? (
        <>
          <Select value={selectValue} onValueChange={handleSelect} disabled={disabled}>
            <SelectTrigger id={id} type="button">
              <SelectValue placeholder={type === 'income' ? 'Select income category' : 'Select expense category'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((category) => (
                <SelectItem key={category} value={category === OTHER_CATEGORY ? OTHER_VALUE : category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select <span className="font-medium">Other</span> at the bottom of the list to type your own category.
          </p>
        </>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed border-primary/30 bg-muted/30 p-3">
          <Label htmlFor={`${id}-other-input`} className="text-sm font-medium">
            Type your category *
          </Label>
          <p className="text-xs text-muted-foreground">
            Enter the category name you want. After you save, it will appear in the dropdown list next time.
          </p>
          <Input
            id={`${id}-other-input`}
            value={otherName}
            onChange={(e) => handleOtherNameChange(e.target.value)}
            placeholder={type === 'income' ? 'e.g. Book sales, Sponsorship' : 'e.g. Cleaning, Insurance'}
            disabled={disabled}
            autoFocus
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline font-medium"
            onClick={handleBackToList}
          >
            ← Back to category list
          </button>
        </div>
      )}
    </div>
  );
};

export async function persistBudgetCategory(type: 'income' | 'expense', name: string) {
  const trimmed = name.trim();
  if (!trimmed || normalizeKey(trimmed) === normalizeKey(OTHER_CATEGORY)) return trimmed;
  try {
    await addBudgetCategory(trimmed, type);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.toLowerCase().includes('already exists')) throw err;
  }
  return trimmed;
}

export default BudgetCategorySelect;
