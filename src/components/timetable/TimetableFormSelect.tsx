import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TimetableFormSelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  options,
  emptyLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  emptyLabel?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[200] max-h-72">
        {emptyLabel ? (
          <SelectItem value="__none__" className="text-slate-600">
            {emptyLabel}
          </SelectItem>
        ) : null}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-slate-900 dark:text-slate-100">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
