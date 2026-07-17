import PartnerLogo from './PartnerLogo';

/** Header lockup for the partners landing — emblem + "ScholarNerve Partner". */
export default function PartnersHeaderBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md shadow-emerald-950/10 ring-1 ring-[var(--sn-border)] sm:h-9 sm:w-9 sm:rounded-xl">
        <PartnerLogo variant="compact" className="h-full w-full" />
      </span>
      <span className="scholar-display truncate text-[15px] font-extrabold leading-tight sm:text-lg">
        <span className="text-[var(--ink)]">ScholarNerve </span>
        <span className="scholar-partner-brand-title">Partner</span>
      </span>
    </div>
  );
}
