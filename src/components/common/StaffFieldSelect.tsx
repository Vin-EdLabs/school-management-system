import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStaffFieldSuggestions } from '@/hooks/useStaffFieldSuggestions';
import type { StaffFieldType } from '@/services/staffFieldApi';
import { FormFieldError } from '@/components/common/FormFieldError';
import { fieldInvalidClass } from '@/utils/formValidation';

const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'Other (type new)';

type StaffFieldSelectProps = {
  field: StaffFieldType;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  error?: string;
};

function normalizeKey(name: string): string {
  return String(name || '').trim().toLowerCase();
}

const StaffFieldSelect: React.FC<StaffFieldSelectProps> = ({
  field,
  value,
  onChange,
  label,
  placeholder,
  disabled,
  id,
  required,
  error,
}) => {
  const { names } = useStaffFieldSuggestions(field);
  const options = useMemo(() => {
    const saved = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return [...saved, OTHER_LABEL];
  }, [names]);

  const valueInList = useMemo(
    () => !!value && options.some((o) => o !== OTHER_LABEL && normalizeKey(o) === normalizeKey(value)),
    [value, options]
  );

  const [mode, setMode] = useState<'select' | 'other'>('select');
  const [otherName, setOtherName] = useState('');

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setMode('select');
      setOtherName('');
      return;
    }
    const match = options.find(
      (o) => o !== OTHER_LABEL && normalizeKey(o) === normalizeKey(trimmed)
    );
    if (match) {
      setMode('select');
      setOtherName('');
    } else {
      setMode('other');
      setOtherName(trimmed);
    }
  }, [value, options]);

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

  const selectValue =
    mode === 'select' && value && valueInList
      ? options.find((o) => o !== OTHER_LABEL && normalizeKey(o) === normalizeKey(value))!
      : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      {mode === 'select' ? (
        <>
          <Select value={selectValue} onValueChange={handleSelect} disabled={disabled}>
            <SelectTrigger id={id} type="button" className={fieldInvalidClass(!!error)}>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option}
                  value={option === OTHER_LABEL ? OTHER_VALUE : option}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose a saved {label.toLowerCase()} or pick <span className="font-medium">Other</span> to type a new one.
            After you save, it appears in this list next time.
          </p>
        </>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed border-primary/30 bg-muted/30 p-3">
          <Label htmlFor={`${id}-other`} className="text-sm font-medium">
            Type {label.toLowerCase()} *
          </Label>
          <Input
            id={`${id}-other`}
            value={otherName}
            onChange={(e) => handleOtherNameChange(e.target.value)}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            disabled={disabled}
            autoFocus
            className={fieldInvalidClass(!!error)}
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline font-medium"
            onClick={() => {
              const typed = otherName.trim();
              const match = options.find(
                (o) => o !== OTHER_LABEL && normalizeKey(o) === normalizeKey(typed)
              );
              if (match) {
                setMode('select');
                setOtherName('');
                onChange(match);
                return;
              }
              setMode('select');
              setOtherName('');
            }}
          >
            ← Back to saved list
          </button>
        </div>
      )}
      <FormFieldError message={error} />
    </div>
  );
};

export default StaffFieldSelect;
