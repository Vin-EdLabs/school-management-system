import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, IdCard, Loader2, ShieldCheck } from 'lucide-react';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';
import type { PartnerProfile } from '@/services/partnerApi';
import { Button } from '@/components/ui/button';
import PartnerCardFront from './PartnerCardFront';
import { downloadPartnerIdCard } from './partnerIdCardExport';

function useResponsiveCardScale(maxScale = 0.68, minScale = 0.38) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.52);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth || 320;
      const next = Math.min(maxScale, Math.max(minScale, (w - 4) / CARD_WIDTH_PX));
      setScale(Number(next.toFixed(3)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [maxScale, minScale]);

  const height = Math.ceil(CARD_HEIGHT_PX * scale);
  return { ref, scale, height };
}

type PartnerIdCardShowcaseProps = {
  partner: PartnerProfile;
  /** compact = schools page strip; full = profile page */
  variant?: 'compact' | 'full';
  className?: string;
};

export default function PartnerIdCardShowcase({
  partner,
  variant = 'full',
  className = '',
}: PartnerIdCardShowcaseProps) {
  const isCompact = variant === 'compact';
  const { ref, scale, height } = useResponsiveCardScale(isCompact ? 0.58 : 0.68, isCompact ? 0.36 : 0.4);
  const [downloading, setDownloading] = useState(false);

  const onDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadPartnerIdCard(partner);
    } catch {
      /* toast optional — keep silent on mobile quota errors */
    } finally {
      setDownloading(false);
    }
  }, [partner]);

  return (
    <div className={`snp-id-showcase ${isCompact ? 'snp-id-showcase--compact' : ''} ${className}`}>
      <div className={`flex flex-col gap-3 ${isCompact ? 'sm:flex-row sm:items-center' : ''}`}>
        <div className={`min-w-0 flex-1 ${isCompact ? 'order-2 sm:order-1' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
              <IdCard className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                Official ScholarNerve Partner ID
              </p>
              <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                {isCompact
                  ? 'Show this when visiting schools — proves you represent ScholarNerve.'
                  : 'Your authorized identity in the Partner Network. Schools can verify you before any demo.'}
              </p>
            </div>
          </div>
          {!isCompact && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-300/90">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 dark:bg-slate-900/60">
                <ShieldCheck className="h-3 w-3" /> Verified partner
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 font-mono dark:bg-slate-900/60">
                {partner.partnerId}
              </span>
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant={isCompact ? 'outline' : 'default'}
            className={`mt-3 rounded-xl ${isCompact ? '' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            disabled={downloading}
            onClick={() => void onDownload()}
          >
            {downloading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Download HD ID</>
            )}
          </Button>
        </div>

        <div
          ref={ref}
          className={`snp-id-preview mx-auto w-full shrink-0 ${isCompact ? 'order-1 max-w-[220px] sm:order-2 sm:max-w-[240px]' : 'max-w-[380px]'}`}
          style={{ height, contain: 'layout' }}
        >
          <div
            className="snp-id-preview-inner"
            style={{
              width: CARD_WIDTH_PX * scale,
              height,
              margin: '0 auto',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: CARD_WIDTH_PX,
                height: CARD_HEIGHT_PX,
                borderRadius: 14,
                boxShadow: '0 6px 24px rgba(8, 80, 65, 0.12)',
                willChange: 'transform',
              }}
            >
              <PartnerCardFront partner={partner} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
