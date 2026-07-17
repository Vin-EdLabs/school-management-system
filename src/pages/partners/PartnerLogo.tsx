import { cn } from '@/lib/utils';

/** ScholarNerve Partner Network emblem — graduation cap, brain network, handshake. */
export const PARTNER_EMBLEM_SRC = '/partners/scholarnerve-partner-emblem.png';
/** @deprecated use PARTNER_EMBLEM_SRC — kept for ID card exports */
export const PARTNER_LOGO_SRC = PARTNER_EMBLEM_SRC;

type PartnerLogoProps = {
  className?: string;
  /** compact = square emblem; full = same emblem, larger display */
  variant?: 'full' | 'compact';
};

export default function PartnerLogo({ className, variant = 'full' }: PartnerLogoProps) {
  return (
    <img
      src={PARTNER_EMBLEM_SRC}
      alt="ScholarNerve Partner Network"
      className={cn('object-contain', variant === 'compact' ? 'aspect-square' : '', className)}
      decoding="async"
      fetchPriority="high"
    />
  );
}
