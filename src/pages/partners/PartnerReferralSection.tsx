import React from 'react';
import { Handshake } from 'lucide-react';

const PREVIEWS = [
  {
    src: '/partners/landing/partner-dashboard.png',
    alt: 'ScholarNerve Partner dashboard with earnings and stats',
    label: 'Your dashboard',
    delay: '0ms',
  },
  {
    src: '/partners/landing/partner-schools.png',
    alt: 'Partner schools page with ID card and referral tracking',
    label: 'Track your schools',
    delay: '80ms',
  },
  {
    src: '/partners/landing/partner-training.png',
    alt: 'Partner Academy training videos',
    label: 'Partner Academy',
    delay: '160ms',
  },
] as const;

export default function PartnerReferralSection({ onApply }: { onApply?: () => void }) {
  const scrollToApply = () => {
    if (onApply) {
      onApply();
      return;
    }
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="referral" className="snp-referral-section scroll-mt-20 px-4 py-20 sm:px-5 sm:py-24">
      <div className="mx-auto max-w-[1140px]">
        <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 xl:gap-14">
          <div className="scroll-reveal lg:max-w-md">
            <p className="snp-referral-eyebrow">Partner referral program</p>
            <h2 className="mt-3 text-[2rem] font-bold leading-[1.12] text-white sm:text-[2.35rem]">
              Refer friends.
              <br />
              <span className="text-[#F5C842]">Earn 20%</span> of their commissions.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white">
              Know someone who can bring schools to ScholarNerve? Share your Partner ID from your dashboard —
              when they earn, you earn too. Every month, automatically.
            </p>

            <div className="snp-referral-highlight mt-6 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5C842]/15 text-[#F5C842]">
                <Handshake className="h-5 w-5" />
              </div>
              <p className="text-sm leading-relaxed text-white/65">
                After approval, copy your ID from the earnings card and send it to friends on WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToApply}
              className="snp-referral-cta mt-8 inline-flex w-full items-center justify-center rounded-full px-8 py-3.5 text-[15px] font-bold transition hover:brightness-105 sm:w-auto"
            >
              Join the Partner Network
            </button>
          </div>

          <div
            className="scroll-reveal snp-referral-phones"
            style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
          >
            <div className="snp-referral-phones-glow pointer-events-none" aria-hidden />
            <div className="snp-referral-phones-grid">
              {PREVIEWS.map((preview) => (
                <figure
                  key={preview.src}
                  className="snp-referral-phone"
                  style={{ '--phone-delay': preview.delay } as React.CSSProperties}
                >
                  <div className="snp-referral-phone-bezel">
                    <img
                      src={preview.src}
                      alt={preview.alt}
                      className="snp-referral-phone-shot"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="snp-referral-phone-caption">{preview.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
