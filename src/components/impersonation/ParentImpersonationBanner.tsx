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
  beginImpersonationTransition,
  clearImpersonationTransition,
  runWithTransitionMinimum,
  IMPERSONATION_TRANSITION_MS,
} from '../../utils/impersonationHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const BANNER_CLASS =
  'snp-parent-impersonation-banner relative flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-600/30 bg-amber-500 px-3 py-2 text-amber-950 sm:px-4 print:hidden';

/** Parent portal impersonation banner with Exit */
const ParentImpersonationBanner: React.FC<{ tenantId: number }> = ({ tenantId }) => {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [exiting, setExiting] = useState(false);
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
    beginImpersonationTransition('Returning to your account…', 'exit', IMPERSONATION_TRANSITION_MS);
    try {
      const restored = await runWithTransitionMinimum(startedAt, () => exitParentImpersonation(tenantId));
      const merged = restoreAdminSession(restored.token, restored.user, restored.backup);
      applyPostExitTenantContext(merged as Record<string, unknown>, restored.backup);
      applySession(restored.token, merged as Record<string, unknown>);
      prepareReturnToAdminDashboard(restored.backup);
      toast({ title: 'Impersonation ended', description: 'Back to your account' });
      const dest = resolvePostImpersonationPath(merged as Record<string, unknown>, restored.backup);
      if (dest.startsWith('http')) {
        window.location.href = dest;
        return;
      }
      navigate(dest, {
        replace: true,
      });
    } catch (e: unknown) {
      clearImpersonationTransition();
      toast({
        title: 'Could not exit impersonation',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className={BANNER_CLASS}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="min-w-0 text-xs font-medium leading-snug sm:text-sm">
            Parent portal · Viewing as{' '}
            <span className="font-bold">{meta.targetName || 'Student'}</span>
            {meta.schoolName ? (
              <span className="hidden sm:inline">{` · ${meta.schoolName}`}</span>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 bg-amber-950 px-3 text-xs text-amber-50 hover:bg-amber-900"
          disabled={exiting}
          onClick={() => void handleExit()}
        >
          {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Exit
        </Button>
    </div>
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
