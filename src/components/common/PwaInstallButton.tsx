import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) {
      window.alert(
        'To install this app, open your browser menu and tap "Install app" or "Add to Home screen".'
      );
      return;
    }
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      // ignored
    } finally {
      setInstallPromptEvent(null);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleInstall}
      className={className}
      title="Add to Home screen"
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
  );
};

export default PwaInstallButton;
