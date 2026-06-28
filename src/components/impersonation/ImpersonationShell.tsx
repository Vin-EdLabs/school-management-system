import React from 'react';
import { Button } from '@/components/ui/button';
import { useImpersonationOptional } from '../../contexts/ImpersonationContext';
import { LogOut, AlertTriangle, Loader2 } from 'lucide-react';

type Props = {
  children: React.ReactNode;
};

const BANNER_CLASS =
  'relative flex shrink-0 items-center justify-center border-b border-amber-600/30 bg-amber-500 px-4 py-2 text-amber-950 print:hidden';

/** Amber inset frame + in-flow banner while impersonating staff */
const ImpersonationShell: React.FC<Props> = ({ children }) => {
  const imp = useImpersonationOptional();
  const active = imp?.isImpersonating && imp.impersonation.mode !== 'parent';

  if (!active) {
    return <>{children}</>;
  }

  const { impersonation, exitImpersonation, loading } = imp!;

  return (
    <div className="flex h-screen flex-col shadow-[inset_0_0_0_4px_#f59e0b]">
      <div className={BANNER_CLASS}>
        <div className="flex max-w-[min(100%,40rem)] items-center justify-center gap-2 px-16 text-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="truncate text-sm font-medium leading-tight">
            Viewing as{' '}
            <span className="font-bold">{impersonation.targetName}</span>
            {' · '}
            <span className="capitalize">{impersonation.targetRole?.replace('-', ' ')}</span>
            {impersonation.schoolName ? (
              <>
                {' · '}
                <span className="font-semibold">{impersonation.schoolName}</span>
              </>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-4 top-1/2 h-7 -translate-y-1/2 shrink-0 gap-1.5 border-amber-900/20 bg-amber-950 px-3 text-xs text-amber-50 hover:bg-amber-900"
          disabled={loading}
          onClick={() => void exitImpersonation()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Exit
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};

export default ImpersonationShell;
