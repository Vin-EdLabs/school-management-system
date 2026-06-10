import React, { useCallback, useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

type LightboxImage = {
  src: string;
  alt: string;
  caption: string;
};

const ROLES = [
  { label: 'Parents', desc: 'Fees, reports & messages' },
  { label: 'Teachers', desc: 'Classes, attendance & grades' },
  { label: 'Admins', desc: 'Full school control' },
] as const;

const STEPS = [
  {
    step: '01',
    title: 'Branded app on every phone',
    desc: 'ScholarNerve powers your school — parents, teachers, and admins each get the right portal with your school’s name and logo on the home screen.',
  },
  {
    step: '02',
    title: 'Notifications that reach everyone',
    desc: 'Parents get fee and report alerts. Teachers receive class updates. Admins stay informed — all on the lock screen, even when the app is closed.',
  },
  {
    step: '03',
    title: 'One tap, no App Store',
    desc: 'Install from the browser in seconds. Open a notification and land exactly where you need to be — perfect for busy parents and teachers on the go.',
  },
] as const;

const FLOAT_PHONES = [
  {
    id: 'home',
    floatClass: 'parent-showcase-float-a',
    positionClass: 'left-1/2 top-[6%] z-20 -translate-x-1/2',
    sizeClass: 'parent-showcase-device--hero',
    src: '/landing/parent-app-homescreen.png',
    alt: 'ScholarNerve and school-branded apps on the home screen',
    caption: 'Your school on their home screen',
    tag: 'Branded PWA',
  },
  {
    id: 'lock',
    floatClass: 'parent-showcase-float-b',
    positionClass: 'right-[0%] top-[0%] z-30',
    sizeClass: 'parent-showcase-device--side',
    src: '/landing/parent-notification-lock.png',
    alt: 'Push notification on the lock screen',
    caption: 'Lock-screen alerts',
    tag: 'Live push',
  },
  {
    id: 'center',
    floatClass: 'parent-showcase-float-c',
    positionClass: 'bottom-[4%] left-[0%] z-30',
    sizeClass: 'parent-showcase-device--side',
    src: '/landing/parent-notification-center.png',
    alt: 'Notifications grouped in the notification center',
    caption: 'All updates together',
    tag: 'Connected',
  },
] as const;

function FloatingPhone({
  src,
  alt,
  tag,
  caption,
  sizeClass,
  priority = false,
  onOpen,
}: {
  src: string;
  alt: string;
  tag: string;
  caption: string;
  sizeClass: string;
  priority?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`parent-showcase-device parent-showcase-device--clickable ${sizeClass}`}
      aria-label={`View larger: ${caption}`}
    >
      <div className="parent-showcase-bezel">
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="parent-showcase-shot"
        />
        <span className="parent-showcase-zoom-hint" aria-hidden="true">
          <ZoomIn className="h-4 w-4" />
        </span>
      </div>
      <span className="parent-showcase-tag">{tag}</span>
    </button>
  );
}

export default function ParentAppShowcase() {
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const openLightbox = useCallback((image: LightboxImage) => {
    setLightbox(image);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  useEffect(() => {
    if (!lightbox) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox, closeLightbox]);

  return (
    <section
      id="parent-app"
      className="parent-showcase-section relative overflow-hidden px-5 py-20 md:py-28"
      aria-labelledby="parent-app-heading"
    >
      <div className="parent-showcase-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="parent-showcase-orb parent-showcase-orb-a pointer-events-none absolute" aria-hidden="true" />
      <div className="parent-showcase-orb parent-showcase-orb-b pointer-events-none absolute" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-14">
          {/* Copy */}
          <div className="scroll-reveal lg:max-w-xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              <span className="parent-showcase-pulse h-2 w-2 rounded-full bg-emerald-400" />
              Mobile apps &amp; alerts
            </p>
            <h2
              id="parent-app-heading"
              className="scholar-display text-4xl font-extrabold leading-[1.08] text-white md:text-5xl"
            >
              Easy access for{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                parents, teachers &amp; admins
              </span>
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-400 md:text-lg">
              Built for the whole school community. Parents and teachers get the smoothest experience — branded apps,
              real push notifications, and secure portals without downloading from an app store.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <span
                  key={role.label}
                  className="inline-flex flex-col rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 sm:flex-row sm:items-center sm:gap-2"
                >
                  <span className="text-xs font-bold text-emerald-300">{role.label}</span>
                  <span className="text-[11px] text-slate-500">{role.desc}</span>
                </span>
              ))}
            </div>

            <div className="mt-8 hidden space-y-3 lg:block">
              {STEPS.map((item, index) => (
                <div
                  key={item.step}
                  className="scroll-reveal flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-md transition-colors hover:border-emerald-400/25"
                  style={{ '--reveal-delay': `${120 + index * 80}ms` } as React.CSSProperties}
                >
                  <span className="scholar-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="scroll-reveal mt-8 hidden flex-wrap items-center gap-2 lg:flex"
              style={{ '--reveal-delay': '360ms' } as React.CSSProperties}
            >
              <FlowChip label="ScholarNerve" sub="One platform" />
              <FlowArrow />
              <FlowChip label="School app" sub="Your brand" highlight />
              <FlowArrow />
              <FlowChip label="Everyone" sub="Notified" />
            </div>
          </div>

          {/* Floating phones */}
          <div
            className="scroll-reveal relative mx-auto w-full max-w-[400px] lg:max-w-none"
            style={{ '--reveal-delay': '160ms' } as React.CSSProperties}
          >
            <div className="parent-showcase-stage relative mx-auto h-[400px] w-full sm:h-[430px] md:h-[460px]">
              <svg
                className="parent-showcase-lines pointer-events-none absolute inset-0 z-0 h-full w-full"
                viewBox="0 0 400 460"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M 120 260 Q 160 200 200 160"
                  stroke="url(#parentFlowGrad)"
                  strokeWidth="2"
                  strokeDasharray="6 8"
                  className="parent-showcase-line-draw"
                />
                <path
                  d="M 200 160 Q 280 120 320 80"
                  stroke="url(#parentFlowGrad)"
                  strokeWidth="2"
                  strokeDasharray="6 8"
                  className="parent-showcase-line-draw"
                  style={{ animationDelay: '0.35s' }}
                />
                <path
                  d="M 200 280 Q 240 340 300 380"
                  stroke="url(#parentFlowGrad)"
                  strokeWidth="2"
                  strokeDasharray="6 8"
                  className="parent-showcase-line-draw"
                  style={{ animationDelay: '0.7s' }}
                />
                <defs>
                  <linearGradient id="parentFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="#6ee7b7" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
                  </linearGradient>
                </defs>
              </svg>

              {FLOAT_PHONES.map((phone, index) => (
                <div
                  key={phone.id}
                  className={`absolute ${phone.floatClass} ${phone.positionClass}`}
                >
                  <FloatingPhone
                    src={phone.src}
                    alt={phone.alt}
                    tag={phone.tag}
                    caption={phone.caption}
                    sizeClass={phone.sizeClass}
                    priority={index === 0}
                    onOpen={() =>
                      openLightbox({ src: phone.src, alt: phone.alt, caption: phone.caption })
                    }
                  />
                </div>
              ))}

              <div className="parent-showcase-glow pointer-events-none absolute left-1/2 top-1/2 z-0 h-[65%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[70px]" />
            </div>

            {/* Captions under stage */}
            <ul className="mt-6 grid grid-cols-3 gap-2 text-center sm:gap-3">
              {FLOAT_PHONES.map((phone) => (
                <li key={phone.id}>
                  <button
                    type="button"
                    onClick={() =>
                      openLightbox({ src: phone.src, alt: phone.alt, caption: phone.caption })
                    }
                    className="text-[11px] font-medium leading-4 text-slate-400 transition-colors hover:text-emerald-300 sm:text-xs"
                  >
                    {phone.caption}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Steps — mobile / tablet */}
        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:hidden">
          {STEPS.map((item, index) => (
            <div
              key={item.step}
              className="scroll-reveal rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md"
              style={{ '--reveal-delay': `${200 + index * 80}ms` } as React.CSSProperties}
            >
              <span className="scholar-display text-sm font-bold text-emerald-400/90">{item.step}</span>
              <h3 className="mt-2 font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>

        <div
          className="scroll-reveal mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 lg:hidden"
          style={{ '--reveal-delay': '280ms' } as React.CSSProperties}
        >
          <FlowChip label="ScholarNerve" sub="One platform" />
          <FlowArrow />
          <FlowChip label="School app" sub="Your brand" highlight />
          <FlowArrow />
          <FlowChip label="Everyone" sub="Notified" />
        </div>
      </div>

      {lightbox && (
        <div
          className="parent-showcase-lightbox fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-8 sm:top-8"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="parent-showcase-lightbox-frame w-full max-w-[min(420px,92vw)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="parent-showcase-bezel parent-showcase-bezel--lightbox">
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                className="parent-showcase-shot parent-showcase-shot--lightbox"
              />
            </div>
            <p className="parent-showcase-lightbox-caption">{lightbox.caption}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function FlowChip({
  label,
  sub,
  highlight = false,
}: {
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center ${
        highlight ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-white/10 bg-white/5'
      }`}
    >
      <p className="text-xs font-semibold text-white sm:text-sm">{label}</p>
      <p className="text-[10px] text-slate-500 sm:text-xs">{sub}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <svg className="h-4 w-4 shrink-0 text-emerald-400/60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
