import React from 'react';
import { cn } from '@/lib/utils';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

/** Modules fully usable before an academic term is activated. */
export const ACTIVE_TERM_EXEMPT_MODULES = new Set([
  'settings',
  'staff-attendance-settings',
  'staff-attendance',
  'my-staff-attendance',
  'complaints',
  'my-complaints',
  'messages',
]);

/**
 * Locks module content when no active term is set.
 * Settings (and exempt modules) stay fully interactive.
 */
export function ActiveTermRequiredShell({
  children,
  activeModule,
}: {
  children: React.ReactNode;
  activeModule: string;
  onOpenSettings?: () => void;
}) {
  const { hasActiveTerm, isLoading } = useActiveTerm();
  const exempt = ACTIVE_TERM_EXEMPT_MODULES.has(activeModule);
  const lockUi = !isLoading && !hasActiveTerm && !exempt;
  const isMessages = activeModule === 'messages';

  return (
    <div
      className={cn(
        lockUi ? 'term-read-only' : undefined,
        isMessages && 'flex min-h-0 flex-1 flex-col'
      )}
    >
      {children}
    </div>
  );
}

export default ActiveTermRequiredShell;
