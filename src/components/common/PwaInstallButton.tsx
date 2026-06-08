import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, MonitorDown, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaInstallButtonProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  /** School logo (absolute URL). Shown on the install button like the parent portal. */
  logoUrl?: string | null;
}

const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({
  className = '',
  variant = 'ghost',
  size = 'icon',
  logoUrl,
}) => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return !!standalone || !!iosStandalone;
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPromptEvent(null);
      setShowInstallHelp(false);
      setIsInstalled(true);
    };
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    standaloneQuery?.addEventListener?.('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      standaloneQuery?.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) {
      setShowInstallHelp(true);
      return;
    }
    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch {
      // ignored
    } finally {
      setInstallPromptEvent(null);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleInstall}
        className={className}
        title="Install app"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-7 w-7 rounded-lg object-contain border border-slate-200/80 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800"
          />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={showInstallHelp} onOpenChange={setShowInstallHelp}>
        <DialogContent className="max-w-sm overflow-hidden border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-5 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded-xl object-contain bg-white p-1" />
                ) : (
                  <Download className="h-6 w-6" />
                )}
              </div>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-white">Install this app</DialogTitle>
                <DialogDescription className="text-slate-300">
                  Add it to your device for a faster, app-like experience.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <div className="flex gap-3">
                <MonitorDown className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Laptop / desktop</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    If your browser supports direct installation, this button will open the install prompt. Otherwise, use the
                    install icon in the address bar or the browser menu.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <div className="flex gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Phone / tablet</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Open your browser menu, then choose <span className="font-medium text-foreground">Install app</span> or{' '}
                    <span className="font-medium text-foreground">Add to Home Screen</span>.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Once installed, this download button disappears automatically.
            </div>
            <Button type="button" className="w-full" onClick={() => setShowInstallHelp(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PwaInstallButton;
