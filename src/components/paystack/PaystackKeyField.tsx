import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PaystackKeyField({
  label,
  value,
  onChange,
  placeholder,
  hasSaved,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hasSaved?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasSaved ? `${placeholder} (leave blank to keep saved)` : placeholder}
          className="font-mono text-sm pr-10"
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-500 hover:text-slate-800"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide key' : 'Show key'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
