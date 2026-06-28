import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import {
  exitParentImpersonation,
  loadParentImpersonationMeta,
  parentImpersonationActive,
  restoreAdminSession,
  prepareReturnToAdminDashboard,
  applyPostExitTenantContext,
  resolvePostImpersonationPath,
  ensureMinimumTransition,
} from '../../utils/impersonationHelpers';
import { useAuth } from '../../contexts/AuthContext';
import ImpersonationTransitionOverlay from './ImpersonationTransitionOverlay';
import { toast } from '@/hooks/use-toast';

const BANNER_CLASS =
  'relative sticky top-0 z-[300] flex shrink-0 items-center justify-center border-b border-amber-600/30 bg-amber-500 px-4 py-2 text-amber-950 print:hidden';

/** Parent portal impersonation banner with Exit */
const ParentImpersonationBanner: React.FC<{ tenantId: number }> = ({ tenantId }) => {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [exiting, setExiting] = useState(false);
  const [transition, setTransition] = useState<{ message: string; phase: 'enter' | 'exit' } | null>(
    null
  );
  const isParentImp = parentImpersonationActive(tenantId);
  const [meta, setMeta] = useState(() => loadParentImpersonationMeta(tenantId));

  useEffect(() => {
    if (isParentImp) setMeta(loadParentImpersonationMeta(tenantId));
  }, [isParentImp, tenantId]);

  if (!isParentImp) return null;

  const handleExit = async () => {
    if (exiting) return;
    const startedAt = Date.now();
    setExiting(true);
    setTransition({ message: 'Returning to your account…', phase: 'exit' });
    try {
      const restored = await exitParentImpersonation(tenantId);
      const merged = restoreAdminSession(restored.token, restored.user, restored.backup);
      applyPostExitTenantContext(merged as Record<string, unknown>, restored.backup);
      applySession(restored.token, merged as Record<string, unknown>);
      prepareReturnToAdminDashboard(restored.backup);
      await ensureMinimumTransition(startedAt);
      toast({ title: 'Impersonation ended', description: 'Back to your account' });
      navigate(resolvePostImpersonationPath(merged as Record<string, unknown>, restored.backup), {
        replace: true,
      });
    } catch (e: unknown) {
      toast({
        title: 'Could not exit impersonation',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setExiting(false);
      setTransition(null);
    }
  };

  return (
    <>
      <div className={BANNER_CLASS}>
        <div className="flex max-w-[min(100%,40rem)] items-center justify-center gap-2 px-16 text-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="truncate text-sm font-medium leading-tight">
            Parent portal · Viewing as{' '}
            <span className="font-bold">{meta.targetName || 'Student'}</span>
            {meta.schoolName ? ` · ${meta.schoolName}` : ''}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="absolute right-4 top-1/2 h-7 -translate-y-1/2 shrink-0 gap-1.5 bg-amber-950 px-3 text-xs text-amber-50 hover:bg-amber-900"
          disabled={exiting}
          onClick={() => void handleExit()}
        >
          {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Exit
        </Button>
      </div>
      {transition ? (
        <ImpersonationTransitionOverlay message={transition.message} phase={transition.phase} />
      ) : null}
    </>
  );
};

export default ParentImpersonationBanner;

export function parentImpersonationBannerOffsetClass(tenantId: number): string {
  const base = 'min-h-screen';
  return parentImpersonationActive(tenantId)
    ? `${base} shadow-[inset_0_0_0_4px_#f59e0b]`
    : base;
}

export { parentImpersonationActive } from '../../utils/impersonationHelpers';
