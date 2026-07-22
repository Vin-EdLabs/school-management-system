import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  CreditCard,
  Crown,
  Globe,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { CONTACT_DEMO_PATH, CONTACT_PATH, REGISTER_SCHOOL_PATH, handleContactNavClick } from '@/utils/landingScroll';
import {
  BillingCycle,
  FEATURE_CATEGORIES,
  FeatureCategory,
  FeatureCategoryIcon,
  FREE_TRIAL_BULLETS,
  PRICING_FAQ,
  PRICING_TIERS,
  TRUST_SCHOOLS,
  calcMonthEquivalent,
  calcTermPrice,
  calcYearPrice,
  calcYearSavings,
  formatGhs,
} from '@/content/pricingData';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const FEATURE_PREVIEW_COUNT = 4;

const FEATURE_ICONS: Record<FeatureCategoryIcon, LucideIcon> = {
  students: GraduationCap,
  academics: BookOpen,
  fees: CreditCard,
  communication: MessageCircle,
  staff: UserCheck,
  portals: LayoutDashboard,
  website: Globe,
  security: ShieldCheck,
};

function RevealBlock({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`sn-pricing-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function FeatureCategoryCard({ cat, index, Icon }: { cat: FeatureCategory; index: number; Icon: LucideIcon }) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, cat.features.length - FEATURE_PREVIEW_COUNT);
  const showReadMore = hiddenCount > 0;

  return (
    <article
      ref={ref}
      className={`sn-feature-card sn-feature-card-fly ${visible ? 'is-visible' : ''} ${expanded ? 'is-expanded' : ''}`}
      style={{ transitionDelay: `${index * 90}ms` }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="sn-feature-icon" aria-hidden>
          <Icon className="h-5 w-5 stroke-[2]" />
        </span>
        <h4 className="sn-feature-card-title scholar-display">{cat.title}</h4>
      </div>
      <ul className="sn-feature-card-list space-y-2.5">
        {cat.features.map((feature, featureIndex) => (
          <li
            key={feature}
            className={`sn-feature-card-item ${featureIndex >= FEATURE_PREVIEW_COUNT ? 'sn-feature-card-item--extra' : ''}`}
          >
            <Check className="sn-feature-card-check" strokeWidth={2.5} aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {showReadMore ? (
        <button
          type="button"
          className="sn-feature-card-read-more"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Read more (${hiddenCount} more)`}
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      ) : null}
    </article>
  );
}

export default function PricingSection() {
  const location = useLocation();
  const [billing, setBilling] = useState<BillingCycle>('term');
  const [studentCount, setStudentCount] = useState(200);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const calculator = useMemo(
    () => ({
      term: calcTermPrice(studentCount),
      year: calcYearPrice(studentCount),
      month: calcMonthEquivalent(studentCount),
      savings: calcYearSavings(studentCount),
    }),
    [studentCount]
  );

  return (
    <section id="pricing" className="scroll-mt-16 sm:scroll-mt-20">
      <div className="parent-showcase-section relative overflow-hidden px-4 py-16 sm:px-5 sm:py-20 lg:py-24">
        <div className="parent-showcase-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="parent-showcase-orb parent-showcase-orb-a pointer-events-none absolute" aria-hidden="true" />
        <div className="parent-showcase-orb parent-showcase-orb-b pointer-events-none absolute" aria-hidden="true" />
        <div className="relative mx-auto max-w-[900px] text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-emerald-400/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            <span className="parent-showcase-pulse h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Simple pricing for Ghanaian schools
          </p>
          <h2 className="scholar-display text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Everything Your School Needs.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
              One Simple Price.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            Pay only for your enrolled students. Every feature included from day one — no upgrades, no hidden fees.
          </p>
          <p className="mx-auto mt-8 inline-flex max-w-xl items-center justify-center rounded-[var(--radius-pill)] border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100">
            Start Free — 2 Months on Us. No Card Required.
          </p>
          <p className="mt-4 text-sm text-slate-500">GHS 5 per student per term · 10% off when billed annually</p>
        </div>
      </div>

      <RevealBlock className="px-4 pb-16 sm:px-5">
        <div className="mx-auto max-w-[980px]">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="sn-pricing-toggle inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                className={`sn-pricing-toggle-btn ${billing === 'term' ? 'is-active' : ''}`}
                onClick={() => setBilling('term')}
              >
                Per Term
              </button>
              <button
                type="button"
                className={`sn-pricing-toggle-btn ${billing === 'year' ? 'is-active' : ''}`}
                onClick={() => setBilling('year')}
              >
                Per Year <span className="ml-1 text-[10px] font-bold text-emerald-600">Save 10%</span>
              </button>
            </div>
          </div>

          <p className="mb-4 text-center text-sm text-[var(--ink-muted)]">
            Not sure about your student count? Start with your current enrollment — you can adjust anytime.
          </p>

          <div className="sn-pricing-table-wrap overflow-hidden rounded-xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="overflow-x-auto">
              <table className="sn-pricing-table w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th>Students</th>
                    <th className={billing === 'term' ? 'sn-col-active' : ''}>Per Term</th>
                    <th className={billing === 'year' ? 'sn-col-active' : ''}>Per Year (Save 10%)</th>
                    <th>Per Month equiv.</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_TIERS.map((tier, index) => (
                    <tr
                      key={tier.students}
                      className={index % 2 === 1 ? 'is-alt' : ''}
                    >
                      <td>
                        <span className="font-bold text-[var(--ink)]">{tier.students.toLocaleString()}</span>
                      </td>
                      <td className="font-bold">{formatGhs(calcTermPrice(tier.students))}</td>
                      <td className="font-bold">{formatGhs(calcYearPrice(tier.students))}</td>
                      <td className="font-bold text-[var(--ink-muted)]">{formatGhs(calcMonthEquivalent(tier.students))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FREE_TRIAL_BULLETS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-900"
              >
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </RevealBlock>

      <RevealBlock className="sn-features-section relative overflow-hidden px-4 py-16 sm:px-5 sm:py-20">
        <div className="sn-features-section-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1100px]">
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-dark)] shadow-sm backdrop-blur-sm">
              <Crown className="h-3.5 w-3.5 text-[var(--brand)]" aria-hidden />
              Fully premium — one plan only
            </div>
            <h3 className="scholar-display text-3xl font-black text-[var(--ink)] sm:text-4xl">
              Fully Premium. Every Feature Included.
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--ink-muted)]">
              No tiers. No locked tools. No upgrades. Every school gets the complete ScholarNerve platform — fully premium from day one.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURE_CATEGORIES.map((cat, index) => {
              const Icon = FEATURE_ICONS[cat.icon];
              return <FeatureCategoryCard key={cat.title} cat={cat} index={index} Icon={Icon} />;
            })}
          </div>
        </div>
      </RevealBlock>

      <RevealBlock className="px-4 py-14 sm:px-5">
        <div className="mx-auto max-w-[900px] text-center">
          <h3 className="scholar-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            Trusted by Schools Across Ghana
          </h3>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {TRUST_SCHOOLS.map((school) => (
              <span key={school} className="sn-trust-pill">
                {school}
              </span>
            ))}
          </div>
          <p className="mt-5 text-sm text-[var(--ink-muted)]">
            Join growing schools already running smarter with ScholarNerve
          </p>
        </div>
      </RevealBlock>

      <RevealBlock className="bg-[var(--surface-2)] px-4 py-16 sm:px-5">
        <div className="mx-auto max-w-[560px] rounded-2xl border border-[var(--sn-border)] bg-white p-6 shadow-[var(--shadow-premium)] sm:p-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--brand)]" />
            <h3 className="scholar-display text-2xl font-bold text-[var(--ink)]">Calculate Your Cost</h3>
          </div>
          <label className="mt-6 block text-sm font-semibold text-[var(--ink-muted)]">
            Number of Students: <span className="text-[var(--brand-dark)]">{studentCount}</span>
          </label>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={studentCount}
            onChange={(e) => setStudentCount(parseInt(e.target.value, 10))}
            className="sn-pricing-slider mt-3 w-full"
          />
          <div className="mt-6 space-y-3 rounded-xl bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--ink-muted)]">Per Term</span>
              <span className="text-lg font-black text-[var(--ink)]">{formatGhs(calculator.term)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--ink-muted)]">Per Year</span>
              <span className="text-lg font-black text-[var(--brand-dark)]">{formatGhs(calculator.year)}</span>
            </div>
            <p className="text-xs font-medium text-emerald-700">
              Save {formatGhs(calculator.savings)} vs paying term-by-term for a full year
            </p>
          </div>
        </div>
      </RevealBlock>

      <RevealBlock className="px-4 py-16 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-[760px]">
          <h3 className="scholar-display text-center text-3xl font-black text-[var(--ink)]">Frequently Asked Questions</h3>
          <div className="mt-8 space-y-3">
            {PRICING_FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.q} className="overflow-hidden rounded-xl border border-[var(--sn-border)] bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
                    onClick={() => setOpenFaq(open ? null : index)}
                    aria-expanded={open}
                  >
                    <span className="font-semibold text-[var(--ink)]">{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div className={`sn-faq-panel ${open ? 'is-open' : ''}`}>
                    <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--ink-muted)] sm:px-5">{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </RevealBlock>

      <div className="sn-pricing-cta px-4 py-16 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-[900px] text-center">
          <h3 className="scholar-display text-3xl font-black text-white sm:text-4xl">
            Ready to Transform How Your School Runs?
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base text-emerald-50/90">
            Join schools across Ghana already saving time, reducing errors, and impressing parents with ScholarNerve.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link to={REGISTER_SCHOOL_PATH} className="sn-pricing-cta-primary">
              Start Free — 2 Months Free
            </Link>
            <a
              href={CONTACT_DEMO_PATH}
              className="sn-pricing-cta-secondary"
              onClick={(e) => handleContactNavClick(e, location.pathname, { demo: true })}
            >
              Book a Free Demo
            </a>
          </div>
          <p className="mt-5 text-sm text-emerald-100/80">No setup fees • No hidden charges • Cancel anytime</p>
          <a
            href={CONTACT_PATH}
            className="mt-4 inline-block text-sm font-semibold text-white underline-offset-4 hover:underline"
            onClick={(e) => handleContactNavClick(e, location.pathname)}
          >
            Contact us instead →
          </a>
        </div>
      </div>
    </section>
  );
}
