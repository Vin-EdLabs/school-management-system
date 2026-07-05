import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useRegisterNavigationGuard } from '../contexts/NavigationGuardContext';

export type UnsavedChangesGuardOptions = {
  isDirty: boolean;
  onSave?: () => Promise<boolean>;
  onDiscard?: () => void;
  message?: string;
  /** When true, also guards sidebar / module navigation */
  guardModuleNavigation?: boolean;
};

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  onDiscard,
  message = 'You have unsaved changes. Save before leaving, or discard your changes.',
  guardModuleNavigation = true,
}: UnsavedChangesGuardOptions) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef<(() => void | Promise<void>) | null>(null);

  useRegisterNavigationGuard(
    guardModuleNavigation
      ? { isDirty, onSave, onDiscard, message }
      : { isDirty: false }
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const runWithGuard = useCallback(
    (action: () => void | Promise<void>) => {
      if (!isDirty) {
        void action();
        return;
      }
      pendingRef.current = action;
      setDialogOpen(true);
    },
    [isDirty]
  );

  const finish = async (mode: 'save' | 'discard' | 'cancel') => {
    const action = pendingRef.current;
    if (mode === 'cancel') {
      pendingRef.current = null;
      setDialogOpen(false);
      return;
    }
    if (mode === 'discard') {
      onDiscard?.();
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
      return;
    }
    if (!onSave) {
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave();
      if (!ok) return;
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
    } finally {
      setSaving(false);
    }
  };

  const UnsavedChangesDialog = (
    <AlertDialog open={dialogOpen} onOpenChange={(o) => { if (!o) void finish('cancel'); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel disabled={saving} onClick={() => void finish('cancel')}>
            Stay on page
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void finish('discard')}
          >
            Discard
          </Button>
          {onSave && (
            <AlertDialogAction disabled={saving} onClick={() => void finish('save')}>
              {saving ? 'Saving…' : 'Save & continue'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { runWithGuard, UnsavedChangesDialog, isDirty };
}
