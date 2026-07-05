import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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

export type NavigationGuardConfig = {
  isDirty: boolean;
  onSave?: () => Promise<boolean>;
  onDiscard?: () => void;
  message?: string;
};

type NavigationGuardContextValue = {
  registerGuard: (config: NavigationGuardConfig | null) => void;
  requestNavigation: (action: () => void | Promise<void>) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<NavigationGuardConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const pendingRef = useRef<(() => void | Promise<void>) | null>(null);

  const registerGuard = useCallback((config: NavigationGuardConfig | null) => {
    guardRef.current = config;
  }, []);

  const requestNavigation = useCallback((action: () => void | Promise<void>) => {
    const guard = guardRef.current;
    if (guard?.isDirty) {
      pendingRef.current = action;
      setDialogMessage(
        guard.message ||
          'You have unsaved changes. Save before leaving, or discard your changes.'
      );
      setDialogOpen(true);
      return;
    }
    void action();
  }, []);

  const finish = async (mode: 'save' | 'discard' | 'cancel') => {
    const action = pendingRef.current;
    const guard = guardRef.current;
    if (mode === 'cancel') {
      pendingRef.current = null;
      setDialogOpen(false);
      return;
    }
    if (mode === 'discard') {
      guard?.onDiscard?.();
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
      return;
    }
    if (!guard?.onSave) {
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
      return;
    }
    setSaving(true);
    try {
      const ok = await guard.onSave();
      if (!ok) return;
      pendingRef.current = null;
      setDialogOpen(false);
      if (action) await action();
    } finally {
      setSaving(false);
    }
  };

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, requestNavigation }}>
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={(o) => { if (!o) void finish('cancel'); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
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
            {guardRef.current?.onSave && (
              <AlertDialogAction disabled={saving} onClick={() => void finish('save')}>
                {saving ? 'Saving…' : 'Save & continue'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}

/** Register module-level dirty state so sidebar navigation is guarded. */
export function useRegisterNavigationGuard(config: NavigationGuardConfig) {
  const ctx = useContext(NavigationGuardContext);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!ctx) return;
    const sync = () => {
      const c = configRef.current;
      ctx.registerGuard(c.isDirty ? c : null);
    };
    sync();
    return () => ctx.registerGuard(null);
  }, [ctx, config.isDirty, config.message, config.onSave, config.onDiscard]);
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    return {
      registerGuard: () => undefined,
      requestNavigation: (action: () => void | Promise<void>) => { void action(); },
    };
  }
  return ctx;
}
