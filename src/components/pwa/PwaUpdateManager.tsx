import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const MAJOR_UPDATE_MODE = import.meta.env.VITE_PWA_MAJOR_UPDATE === 'true';

/**
 * Service worker lifecycle: detect new deployments, safe reload, optional background activation.
 */
export function PwaUpdateManager() {
  const [showMajorModal, setShowMajorModal] = useState(false);
  const [showMinorBanner, setShowMinorBanner] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const dismissedRef = useRef(false);
  const reloadOnceRef = useRef(false);

  const applyUpdate = useCallback(() => {
    const w = waitingRef.current;
    if (!w) return;
    dismissedRef.current = false;
    w.postMessage({ type: 'SKIP_WAITING' });
    setShowMajorModal(false);
    setShowMinorBanner(false);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      if (reloadOnceRef.current) return;
      reloadOnceRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    let interval: ReturnType<typeof setInterval> | undefined;

    const considerWaiting = (reg: ServiceWorkerRegistration) => {
      const w = reg.waiting;
      if (!w || !navigator.serviceWorker.controller) return;
      waitingRef.current = w;
      dismissedRef.current = false;
      if (MAJOR_UPDATE_MODE) setShowMajorModal(true);
      else setShowMinorBanner(true);
    };

    const attach = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        dismissedRef.current = false;
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') considerWaiting(reg);
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      considerWaiting(reg);
      attach(reg);
      reg.update().catch(() => undefined);
      interval = window.setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
    });

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      if (MAJOR_UPDATE_MODE || dismissedRef.current) return;
      void navigator.serviceWorker.getRegistration().then((reg) => {
        const w = reg?.waiting;
        if (!w) return;
        waitingRef.current = w;
        w.postMessage({ type: 'SKIP_WAITING' });
      });
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Dialog
        open={showMajorModal}
        onOpenChange={(open) => {
          if (!open) {
            dismissedRef.current = true;
            setShowMajorModal(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>A new update is available</DialogTitle>
            <DialogDescription>
              ScholarNerve has a newer version. Update now to get the latest fixes and features. You stay signed in after updating.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                dismissedRef.current = true;
                setShowMajorModal(false);
              }}
            >
              Later
            </Button>
            <Button type="button" onClick={applyUpdate}>
              Update now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showMinorBanner && !MAJOR_UPDATE_MODE && (
        <div
          className="fixed bottom-0 inset-x-0 z-[100] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="status"
        >
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-800 font-medium">A new update is available.</p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-600"
                onClick={() => {
                  dismissedRef.current = true;
                  setShowMinorBanner(false);
                }}
              >
                Later
              </Button>
              <Button type="button" size="sm" onClick={applyUpdate}>
                Update now
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
