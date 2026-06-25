import React from 'react';
import { cn } from '@/lib/utils';

export function FormFieldError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p className={cn('text-sm font-medium text-destructive mt-1', className)} role="alert">
      {message}
    </p>
  );
}

export function FormValidationSummary({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive',
        className
      )}
      role="alert"
    >
      {message}
    </div>
  );
}
