import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBudgetCategories } from '../../hooks/useBudgetCategories';
import { addBudgetCategory } from '../../services/termBudgetApi';

const ADD_NEW = '__add_new__';

type BudgetCategorySelectProps = {
  type: 'income' | 'expense';
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
};

const BudgetCategorySelect: React.FC<BudgetCategorySelectProps> = ({
  type,
  value,
  onChange,
  label,
  disabled,
  id,
}) => {
  const { categoryNames } = useBudgetCategories(type);
  const [mode, setMode] = useState<'select' | 'new'>(value && !categoryNames.includes(value) ? 'new' : 'select');
  const [newName, setNewName] = useState(value && !categoryNames.includes(value) ? value : '');

  const options = useMemo(() => {
    const merged = Array.from(new Set([...categoryNames.filter(Boolean)])).sort((a, b) =>
      a.localeCompare(b)
    );
    return merged;
  }, [categoryNames]);

  const handleSelect = (selected: string) => {
    if (selected === ADD_NEW) {
      setMode('new');
      setNewName('');
      onChange('');
      return;
    }
    setMode('select');
    setNewName('');
    onChange(selected);
  };

  const handleNewNameChange = (name: string) => {
    setNewName(name);
    onChange(name);
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      {mode === 'select' ? (
        <Select value={value || undefined} onValueChange={handleSelect} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={type === 'income' ? 'Select income category' : 'Select expense category'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
            <SelectItem value={ADD_NEW}>+ Add new category…</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-2">
          <Input
            id={id}
            value={newName}
            onChange={(e) => handleNewNameChange(e.target.value)}
            placeholder={`Type new ${type} category`}
            disabled={disabled}
            autoFocus
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => {
              setMode('select');
              setNewName('');
              onChange('');
            }}
          >
            Choose from existing categories
          </button>
        </div>
      )}
    </div>
  );
};

export async function persistBudgetCategory(type: 'income' | 'expense', name: string) {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  try {
    await addBudgetCategory(trimmed, type);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.toLowerCase().includes('already exists')) throw err;
  }
  return trimmed;
}

export default BudgetCategorySelect;
