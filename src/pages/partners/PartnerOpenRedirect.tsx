import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Email / external links land here first so installed PWAs can capture navigation. */
export default function PartnerOpenRedirect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const raw = params.get('to') || '/';
    const target = raw.startsWith('/') ? raw : `/${raw}`;

    if (isStandalonePwa()) {
      navigate(target, { replace: true });
      return;
    }

    const openTarget = () => {
      navigate(target, { replace: true });
    };

    void (async () => {
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const related = await (navigator as Navigator & {
            getInstalledRelatedApps?: () => Promise<Array<{ platform?: string }>>;
          }).getInstalledRelatedApps?.();
          const hasWebApp = related?.some((app) => app.platform === 'webapp');
          if (hasWebApp) {
            // Same-origin navigation — Android may route this into the installed PWA
            // when capture_links is enabled in the manifest.
            window.location.replace(`${window.location.origin}${target}`);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      openTarget();
    })();
  }, [navigate, params]);

  return (
    <div className="sn-partner-portal flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 dark:bg-slate-950">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Opening ScholarNerve Partners…</p>
    </div>
  );
}
