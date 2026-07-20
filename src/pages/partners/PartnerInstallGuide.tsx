import { useCallback, useEffect, useState } from 'react';
import {
  Check, CheckCircle2, Download, MoreVertical, Share, Smartphone, SquarePlus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PartnerLogo from './PartnerLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type MobilePlatform = 'ios' | 'android' | 'other';

export function detectMobilePlatform(): MobilePlatform {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function isMobileBrowser(): boolean {
  const platform = detectMobilePlatform();
  if (platform === 'ios' || platform === 'android') return true;
  return window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function shouldShowInstallPrompt(): boolean {
  return isMobileBrowser() && !isStandalonePwa();
}

const IOS_STEPS = [
  {
    icon: Share,
    title: 'Tap Share',
    detail: 'At the bottom of Safari, tap the Share button (square with an arrow pointing up).',
  },
  {
    icon: SquarePlus,
    title: 'Add to Home Screen',
    detail: 'Scroll the menu and tap Add to Home Screen.',
  },
  {
    icon: CheckCircle2,
    title: 'Confirm Add',
    detail: 'Tap Add in the top-right corner. ScholarNerve Partners opens from your home screen like an app.',
  },
];

const ANDROID_STEPS = [
  {
    icon: MoreVertical,
    title: 'Open browser menu',
    detail: 'Tap the three dots (⋮) in the top-right corner of Chrome.',
  },
  {
    icon: Download,
    title: 'Install app',
    detail: 'Tap Install app or Add to Home screen.',
  },
  {
    icon: Smartphone,
    title: 'Open from home screen',
    detail: 'Confirm Install. Use the icon on your home screen — no browser bar, faster access.',
  },
];

const OTHER_STEPS = [
  {
    icon: Download,
    title: 'Use browser menu',
    detail: 'Open your browser menu and look for Install app or Add to Home Screen.',
  },
  {
    icon: Smartphone,
    title: 'Add to home screen',
    detail: 'Confirm the install. Open ScholarNerve Partners from your home screen next time.',
  },
];

function stepsForPlatform(platform: MobilePlatform) {
  if (platform === 'ios') return IOS_STEPS;
  if (platform === 'android') return ANDROID_STEPS;
  return OTHER_STEPS;
}

function InstallStepList({ platform }: { platform: MobilePlatform }) {
  const steps = stepsForPlatform(platform);
  return (
    <ol className="snp-install-steps">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.title} className="snp-install-step">
            <div className="snp-install-step-num" aria-hidden>{index + 1}</div>
            <div className="snp-install-step-icon" aria-hidden>
              <Icon className="h-5 w-5" />
            </div>
            <div className="snp-install-step-body">
              <p className="snp-install-step-title">{step.title}</p>
              <p className="snp-install-step-detail">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PartnerInstallGuideModal({
  open,
  onClose,
  platform,
  installPrompt,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  platform: MobilePlatform;
  installPrompt: BeforeInstallPromptEvent | null;
  onInstalled: () => void;
}) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') onInstalled();
    } catch {
      /* ignored */
    } finally {
      setInstalling(false);
    }
  };

  if (!open) return null;

  const platformLabel =
    platform === 'ios' ? 'iPhone / iPad' : platform === 'android' ? 'Android phone' : 'Your phone';

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="snp-install-guide relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-emerald-200/60 bg-white shadow-2xl sm:rounded-[28px] dark:border-emerald-900/50 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="snp-install-guide-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="snp-install-guide-hero px-6 pb-4 pt-8 text-center sm:px-8 sm:pt-10">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-1 ring-emerald-100 dark:bg-slate-800 dark:ring-emerald-900">
            <PartnerLogo variant="compact" className="h-full w-full" />
          </div>
          <p className="snp-install-guide-eyebrow">Use on your phone</p>
          <h2 id="snp-install-guide-title" className="mt-2 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            Add ScholarNerve Partners to your home screen
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Install once on {platformLabel} — open like an app, get payout alerts faster, and skip typing the website each time.
          </p>
        </div>

        <div className="px-6 pb-8 sm:px-8">
          {installPrompt ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/30">
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Quick install</p>
              <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                Your browser supports one-tap install.
              </p>
              <Button
                type="button"
                disabled={installing}
                className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => void handleInstall()}
              >
                {installing ? 'Installing…' : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Install now
                  </>
                )}
              </Button>
            </div>
          ) : null}

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {installPrompt ? 'Or follow these steps' : 'Follow these steps'}
          </p>
          <InstallStepList platform={platform} />

          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="leading-relaxed">
              After installing, sign in with the same email or phone number you use on the website.
            </p>
          </div>

          <Button
            type="button"
            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen guide on every mobile browser visit until the app is installed. */
export function PartnerInstallGuide() {
  const [open, setOpen] = useState(false);
  const [platform] = useState<MobilePlatform>(() => detectMobilePlatform());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => !shouldShowInstallPrompt());

  useEffect(() => {
    try {
      localStorage.removeItem('snPartnerInstallGuideSeen');
      localStorage.removeItem('snPartnerA2hsDismissed');
    } catch {
      /* quota */
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const onInstalled = useCallback(() => {
    setInstallPrompt(null);
    setOpen(false);
    setInstalled(true);
  }, []);

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalledEvent = () => onInstalled();
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) onInstalled();
    };
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalledEvent);
    standaloneQuery.addEventListener('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalledEvent);
      standaloneQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, [installed, onInstalled]);

  useEffect(() => {
    if (installed) return;
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, [installed]);

  useEffect(() => {
    const onOpen = () => {
      if (!shouldShowInstallPrompt()) return;
      setOpen(true);
    };
    window.addEventListener('sn-partner-install-guide-open', onOpen);
    return () => window.removeEventListener('sn-partner-install-guide-open', onOpen);
  }, []);

  if (installed) return null;

  return (
    <PartnerInstallGuideModal
      open={open}
      onClose={close}
      platform={platform}
      installPrompt={installPrompt}
      onInstalled={onInstalled}
    />
  );
}

export function openPartnerInstallGuide() {
  window.dispatchEvent(new CustomEvent('sn-partner-install-guide-open'));
}

/** Compact reminder above bottom nav — always visible in mobile browser until installed. */
export function PartnerInstallBanner() {
  const platform = detectMobilePlatform();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [installed, setInstalled] = useState(() => !shouldShowInstallPrompt());

  useEffect(() => {
    if (installed) return;
    const onInstalledEvent = () => setInstalled(true);
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true);
    };
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('appinstalled', onInstalledEvent);
    standaloneQuery.addEventListener('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('appinstalled', onInstalledEvent);
      standaloneQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, [installed]);

  if (installed || sessionDismissed) return null;

  const label =
    platform === 'ios'
      ? 'Add to Home Screen for app-like access'
      : 'Install on your phone for faster access';

  return (
    <div className="snp-a2hs-banner snp-fade-up">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg dark:bg-emerald-950/50" aria-hidden>
        📱
      </span>
      <span className="snp-a2hs-text">{label}</span>
      <button type="button" className="snp-a2hs-how" onClick={() => openPartnerInstallGuide()}>
        How?
      </button>
      <button type="button" className="snp-a2hs-dismiss" aria-label="Dismiss for now" onClick={() => setSessionDismissed(true)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function usePartnerInstallAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(isMobileBrowser() && !isStandalonePwa());
  }, []);
  return available;
}
