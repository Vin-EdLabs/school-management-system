import React from 'react';
import { cn } from '@/lib/utils';
import ClosedTermBanner from './ClosedTermBanner';
import { useTermReadOnly } from '../../contexts/TermStatusContext';

/** Modules that stay fully editable even when viewing a closed term (term management). */
const READ_ONLY_EXEMPT_MODULES = new Set(['settings']);

/**
 * Wraps module content — disables interactive controls when viewing a closed term.
 * Settings is always exempt so admins can add or activate terms.
 */
export function TermReadOnlyShell({
  children,
  activeModule,
}: {
  children: React.ReactNode;
  activeModule: string;
}) {
  const { readOnly } = useTermReadOnly();
  const exempt = READ_ONLY_EXEMPT_MODULES.has(activeModule);
  const lockUi = readOnly && !exempt;

  return (
    <div
      className={cn(
        lockUi ? 'term-read-only' : undefined,
        activeModule === 'messages' && 'flex min-h-0 flex-1 flex-col'
      )}
    >
      {readOnly ? <ClosedTermBanner inSettings={exempt} /> : null}
      {children}
    </div>
  );
}

export default TermReadOnlyShell;
