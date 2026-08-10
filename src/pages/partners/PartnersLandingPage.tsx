import React, { useEffect, useRef } from 'react';
import {
  ArrowRight, Award, CheckCircle2, ChevronDown, Crown, GraduationCap, Handshake,
  IdCard, LayoutDashboard, Medal, Megaphone, PlayCircle, School, Smartphone, Star,
  Trophy, Users, Video, Wallet,
} from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import ScrollToTopButton from '@/components/landing/ScrollToTopButton';
import PartnersHeaderBrand from './PartnersHeaderBrand';
import PartnerLogo from './PartnerLogo';
import PartnerRegistrationWizard from './PartnerRegistrationWizard';
import PartnerReferralSection from './PartnerReferralSection';
import { getPartnersPortalLoginUrl } from '@/utils/partnersHost';
import './partners.css';

const STEPS = [
  {
    icon: CheckCircle2,
    title: 'Apply and get approved',
    body: 'Fill your application on scholarnerve.com/#partners. The ScholarNerve team reviews it within 48 hours. Once approved you receive your official Partner ID and full dashboard access.',
  },
  {
    icon: PlayCircle,
    title: 'Complete your training',
    body: 'Watch the short training videos in your dashboard. Join a strategy session with the ScholarNerve team. You will know exactly what to say and how to introduce the platform confidently.',
  },
  {
    icon: School,
    title: 'Visit schools and spark interest',
    body: 'Go to schools in your area. Share the one-pager we give you. Show the 90-second demo video on your phone. Your only goal is to get the proprietor to agree to a 30-minute Zoom call.',
  },
  {
    icon: Video,
    title: 'ScholarNerve closes the deal',
    body: 'We handle the Zoom demo, pricing conversation, and full onboarding. The school gets linked to your Partner ID automatically.',
  },
  {
    icon: Wallet,
    title: 'Earn every month',
    body: 'Once the school starts paying you earn 50% for the first 2 months then 30% every month after — for as long as that school remains active. The more schools in your portfolio the higher your monthly income.',
  },
];

const EARNINGS_EXAMPLE_ROWS = [
  { schools: 1, schoolPays: 'GHS 500', cut: '30%', monthly: 150 },
  { schools: 3, schoolPays: 'GHS 500 each', cut: '30%', monthly: 450 },
  { schools: 5, schoolPays: 'GHS 500 each', cut: '30%', monthly: 750 },
  { schools: 10, schoolPays: 'GHS 500 each', cut: '30%', monthly: 1500 },
  { schools: 20, schoolPays: 'GHS 500 each', cut: '30%', monthly: 3000 },
];

const TIERS = [
  {
    icon: Star,
    name: 'Partner',
    range: '1–2 active schools',
    body: 'Start your journey — earn recurring commission from your very first school.',
    highlight: false,
  },
  {
    icon: Medal,
    name: 'Senior Partner',
    range: '3–4 active schools',
    body: 'A proven builder with a growing monthly income and priority support.',
    highlight: false,
  },
  {
    icon: Trophy,
    name: 'Team Leader',
    range: '5–9 active schools',
    body: 'Lead the movement in your area with strategy sessions and exclusive perks.',
    highlight: true,
  },
  {
    icon: Crown,
    name: 'Regional Director',
    range: '10+ active schools',
    body: 'The top of the network — a true school-tech entrepreneur earning like an executive.',
    highlight: true,
  },
];

const PERKS = [
  { icon: IdCard, title: 'Official Partner ID', body: 'Your own SN partner identity that schools can trust and verify.' },
  { icon: LayoutDashboard, title: 'Personal Dashboard', body: 'Track your schools, commissions and payouts in real time from your phone.' },
  { icon: PlayCircle, title: 'Training Videos', body: 'Short, practical lessons that turn you into a confident school closer.' },
  { icon: Users, title: 'Strategy Sessions', body: 'Regular sessions with the ScholarNerve team to sharpen your approach.' },
  { icon: Megaphone, title: 'Marketing Materials', body: 'Ready-made flyers and WhatsApp content designed to open doors.' },
  { icon: Smartphone, title: 'MoMo Payouts', body: 'Commissions paid directly to your mobile money — no bank account needed.' },
];

export function PartnersLandingSection({ hideHero = false }: { hideHero?: boolean }) {
  const formRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToSteps = () => stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div id="partners">
        {!hideHero ? (
        <section className="scholar-hero-bg relative flex min-h-[calc(100dvh-64px)] items-center px-4 pb-16 pt-12 sm:px-5 sm:pb-20 sm:pt-16">
          <div className="relative mx-auto w-full max-w-[1100px] text-center">
            <div className="scholar-fade-up mx-auto mb-6 flex justify-center" style={{ animationDelay: '0s' }}>
              <PartnerLogo variant="compact" className="h-24 w-24 drop-shadow-lg sm:h-28 sm:w-28" />
            </div>
            <div
              className="scholar-fade-up mx-auto mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--sn-border)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--brand-dark)] shadow-sm backdrop-blur"
              style={{ animationDelay: '0.04s' }}
            >
              <span className="scholar-pulse-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
              <Handshake className="h-3.5 w-3.5" />
              ScholarNerve Partner Network
            </div>

            <h1
              className="scholar-display scholar-fade-up scholar-section-title mx-auto max-w-4xl text-[var(--ink)]"
              style={{ animationDelay: '0.08s' }}
            >
              Turn your network into{' '}
              <span className="relative inline-block bg-gradient-to-r from-[var(--brand)] via-teal-500 to-[var(--brand-dark)] bg-clip-text text-transparent">
                monthly income
              </span>
              .
            </h1>

            <p
              className="scholar-fade-up mx-auto mt-5 max-w-[560px] text-base font-light leading-7 text-[var(--ink-muted)] sm:mt-6 sm:text-[1.08rem] sm:leading-8"
              style={{ animationDelay: '0.18s' }}
            >
              Introduce schools to ScholarNerve. Earn every month they stay — forever.
              No laptop needed. No tech background required.
            </p>

            <div
              className="scholar-fade-up mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:mt-8 sm:gap-3"
              style={{ animationDelay: '0.28s' }}
            >
              {[
                { icon: Wallet, text: '30% recurring commission' },
                { icon: Award, text: '50% bonus first 2 months' },
                { icon: GraduationCap, text: '3+ schools live today' },
              ].map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--sn-border)] bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)] shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--brand)]" />
                  {text}
                </span>
              ))}
            </div>

            <div
              className="scholar-fade-up mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:items-center sm:justify-center"
              style={{ animationDelay: '0.38s' }}
            >
              <button type="button" onClick={scrollToForm} className="scholar-btn-primary inline-flex items-center justify-center gap-2 !py-3.5">
                Apply Now <ArrowRight className="h-4 w-4" />
              </button>
              <a href={getPartnersPortalLoginUrl()} className="snp-partner-login-hero-btn">
                Partner Login
              </a>
              <button type="button" onClick={scrollToSteps} className="scholar-btn-secondary hidden sm:inline-flex">
                See how it works <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <p
              className="scholar-fade-up mt-4 text-center text-sm text-[var(--ink-subtle)] sm:hidden"
              style={{ animationDelay: '0.42s' }}
            >
              Already approved?{' '}
              <a href={getPartnersPortalLoginUrl()} className="snp-partner-login-inline-link">
                Sign in to your dashboard
              </a>
            </p>
          </div>
        </section>
        ) : null}

        {/* How it works */}
        <section
          id="how-it-works"
          ref={stepsRef}
          className="scroll-mt-20 bg-[var(--surface-2)] px-4 py-20 sm:px-5 sm:py-24"
        >
          <div className="mx-auto max-w-[720px]">
            <div className="scroll-reveal text-center">
              <p className="scholar-eyebrow">How it works</p>
              <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
                How the Partner Program Works
              </h2>
            </div>

            <div className="relative mt-12 space-y-4">
              <div className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-[var(--brand)]/20 via-[var(--brand)]/40 to-[var(--brand)]/20 sm:left-[31px]" />
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="scroll-reveal scholar-feature-card relative flex items-start gap-4 p-5 sm:gap-5 sm:p-6"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="relative z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--brand-light)] ring-1 ring-[var(--sn-border)] sm:h-16 sm:w-16">
                    <step.icon className="h-5 w-5 text-[var(--brand-dark)] sm:h-6 sm:w-6" />
                    <span className="mt-0.5 text-[11px] font-extrabold text-[var(--brand-dark)]">{i + 1}</span>
                  </div>
                  <div className="pt-0.5 text-left">
                    <h3 className="scholar-display text-[17px] font-bold text-[var(--ink)] sm:text-lg">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[14.5px] font-light leading-relaxed text-[var(--ink-muted)]">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Earnings */}
        <section id="earnings" className="scroll-mt-20 px-4 py-20 sm:px-5 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="scroll-reveal text-center">
              <p className="scholar-eyebrow">Earnings</p>
              <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
                The more schools you build, the more you earn.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] font-light text-[var(--ink-muted)]">
                Example: school pays GHS 500/month — you earn 30% recurring (50% for the first 2 months).
              </p>
            </div>

            <div className="scroll-reveal mt-10 space-y-6">
              <div className="overflow-hidden rounded-[28px] border border-[var(--sn-border-strong)] bg-white shadow-[0_8px_40px_rgba(8,80,65,0.08)]">
                <div className="border-b border-[var(--sn-border)] bg-gradient-to-br from-[var(--brand-light)]/80 to-white px-6 py-8 text-center sm:px-10">
                  <h3 className="scholar-display text-[22px] font-extrabold text-[var(--ink)] sm:text-[28px]">
                    See Exactly How It Adds Up
                  </h3>
                  <p className="mx-auto mt-2 max-w-lg text-[14px] font-medium text-[var(--ink-muted)] sm:text-[15px]">
                    Based on a school paying GHS 500/month — your 30% recurring cut.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-[13px] sm:text-[14px]">
                    <thead>
                      <tr className="border-b border-[var(--sn-border)] bg-[var(--surface-2)]">
                        <th className="px-4 py-3.5 font-bold text-[var(--ink-subtle)] sm:px-6">Your Portfolio</th>
                        <th className="px-4 py-3.5 font-bold text-[var(--ink-subtle)] sm:px-6">School Pays</th>
                        <th className="px-4 py-3.5 font-bold text-[var(--ink-subtle)] sm:px-6">Your Cut</th>
                        <th className="px-4 py-3.5 font-bold text-[var(--ink-subtle)] sm:px-6">Your Monthly Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EARNINGS_EXAMPLE_ROWS.map((row) => (
                        <tr key={row.schools} className="border-b border-[var(--sn-border)] last:border-b-0">
                          <td className="px-4 py-4 font-semibold text-[var(--ink)] sm:px-6">
                            {row.schools} {row.schools === 1 ? 'school' : 'schools'}
                          </td>
                          <td className="px-4 py-4 text-[var(--ink-muted)] sm:px-6">{row.schoolPays}</td>
                          <td className="px-4 py-4 text-[var(--ink-muted)] sm:px-6">{row.cut}</td>
                          <td className="px-4 py-4 sm:px-6">
                            <span className="text-[15px] font-extrabold text-[#c9920a] sm:text-[16px]">
                              GHS {row.monthly.toLocaleString()}/month
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-[var(--sn-border)] bg-[var(--surface-2)]/60 px-6 py-4 sm:px-8">
                  <p className="text-center text-[13px] leading-relaxed text-[var(--ink-muted)] sm:text-[14px]">
                    <span className="font-semibold text-[var(--ink)]">First 2 months per school you earn 50%</span>
                    {' '}— GHS 250 instead of GHS 150. Every new school you add gives you an immediate income boost.
                  </p>
                </div>
              </div>

              <div className="scroll-reveal relative overflow-hidden rounded-[28px] border border-[var(--sn-border-strong)] bg-gradient-to-br from-[var(--brand-light)] via-white to-[var(--surface-3)] p-8 text-center sm:p-12">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--brand)]/10 blur-3xl" />
                <Trophy className="relative mx-auto h-10 w-10 text-[var(--brand)]" />
                <blockquote className="scholar-display relative mx-auto mt-5 max-w-3xl text-[18px] font-bold leading-relaxed text-[var(--ink)] sm:text-[24px]">
                  A National Service person earns GHS 700+ a month. With just 4 school referrals on ScholarNerve, you
                  can match that on the side, in your spare time, without leaving your current job or school and unlike
                  a salary, nobody can fire you from your commissions as long as those schools stay active.
                </blockquote>
              </div>

              <p className="text-center text-[12px] leading-relaxed text-[var(--ink-subtle)] sm:text-[13px]">
                Income figures are based on GHS 500/month school subscription at 30% commission rate. Actual earnings
                depend on the subscription plan of each school you refer.
              </p>
            </div>
          </div>
        </section>

        {/* Tiers */}
        <section id="tiers" className="scroll-mt-20 bg-[var(--surface-2)] px-4 py-20 sm:px-5 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="scroll-reveal text-center">
              <p className="scholar-eyebrow">Partner tiers</p>
              <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
                Grow your portfolio, climb the ranks
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {TIERS.map((tier, i) => (
                <div
                  key={tier.name}
                  className={`scroll-reveal scholar-feature-card flex h-full flex-col p-5 sm:p-6 ${
                    tier.highlight ? 'ring-2 ring-[var(--brand)]/35' : ''
                  }`}
                  style={{ transitionDelay: `${i * 55}ms` }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-light)] ring-1 ring-[var(--sn-border)]">
                    <tier.icon className="h-5 w-5 text-[var(--brand-dark)]" />
                  </div>
                  <h3 className="scholar-display mt-4 text-[16px] font-extrabold text-[var(--ink)]">
                    {tier.name}
                  </h3>
                  <p className="mt-0.5 text-[13.5px] font-bold text-[var(--brand)]">{tier.range}</p>
                  <p className="mt-2 text-[13.5px] font-light leading-relaxed text-[var(--ink-muted)]">
                    {tier.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="px-4 py-20 sm:px-5 sm:py-24">
          <div className="mx-auto max-w-[900px]">
            <div className="scroll-reveal text-center">
              <p className="scholar-eyebrow">What you get</p>
              <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
                Everything you need to win
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PERKS.map((perk, i) => (
                <div
                  key={perk.title}
                  className="scroll-reveal scholar-feature-card flex items-start gap-4 p-5 sm:p-6"
                  style={{ transitionDelay: `${i * 45}ms` }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-light)] ring-1 ring-[var(--sn-border)]">
                    <perk.icon className="h-5 w-5 text-[var(--brand-dark)]" />
                  </div>
                  <div className="text-left">
                    <h3 className="scholar-display text-[15.5px] font-bold text-[var(--ink)]">{perk.title}</h3>
                    <p className="mt-1 text-[14px] font-light leading-relaxed text-[var(--ink-muted)]">
                      {perk.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PartnerReferralSection onApply={scrollToForm} />

        {/* Registration wizard */}
        <section
          id="apply"
          ref={formRef}
          className="scroll-mt-20 bg-[var(--surface-2)] px-4 py-20 sm:px-5 sm:py-24"
        >
          <div className="mx-auto max-w-[640px]">
            <div className="scroll-reveal text-center">
              <p className="scholar-eyebrow">Join the network</p>
              <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
                Create your partner account
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] font-light text-[var(--ink-muted)]">
                Five quick steps — about two minutes. Click Next through each stage, then create your account.
              </p>
            </div>

            <PartnerRegistrationWizard />
          </div>
        </section>
    </div>
  );
}

/** Dedicated partner apply landing at /#partners — separate from the school homepage. */
export default function PartnersLandingPage() {
  useEffect(() => {
    document.title = 'Become a ScholarNerve Partner — Turn Your Network Into Monthly Income';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.scroll-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#apply') {
      window.setTimeout(() => {
        document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, []);

  return (
    <div className="scholar-landing min-h-screen overflow-x-hidden">
      <LandingHeader
        brandMark={null}
        brandLockup={<PartnersHeaderBrand />}
        brandHref="/#partners"
        variant="partners"
      />

      <main className="pt-14 sm:pt-16">
        <PartnersLandingSection />
      </main>

      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
