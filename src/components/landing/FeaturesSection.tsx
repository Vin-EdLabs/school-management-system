import React from 'react';
import { Building2 } from 'lucide-react';

type IconProps = { className?: string };

const IconStudent = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7 11v4.2c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconChart = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 16v-5M12 16V8M16 16v-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const IconWallet = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 7.5h13A2.5 2.5 0 0 1 20 10v6.5A2.5 2.5 0 0 1 17.5 19h-13A2.5 2.5 0 0 1 2 16.5V10a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5 7.5 15.2 4.8A2.2 2.2 0 0 1 18 6.9v.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16.5 13h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const IconClock = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconGrade = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 3.8h10A2.2 2.2 0 0 1 19.2 6v12A2.2 2.2 0 0 1 17 17.2H7A2.2 2.2 0 0 1 4.8 15V6A2.2 2.2 0 0 1 7 3.8Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 9h8M8 13h5M8 17h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconPhone = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 3.5h6A2.5 2.5 0 0 1 17.5 6v12A2.5 2.5 0 0 1 15 20.5H9A2.5 2.5 0 0 1 6.5 18V6A2.5 2.5 0 0 1 9 3.5Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10.5 17.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconShield = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.8 19 6.6v5.2c0 4.2-2.8 7.4-7 8.4-4.2-1-7-4.2-7-8.4V6.6l7-2.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type PublicStats = {
  schools: number;
  students: number;
  teachersAndStaff: number;
  feesProcessed: number;
};

const formatCount = (value: number) => {
  if (!value) return 'Live';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return value.toLocaleString();
};

const formatMoney = (value: number) => {
  if (!value) return 'Tracked';
  if (value >= 1000000) return `GHS ${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `GHS ${(value / 1000).toFixed(0)}k`;
  return `GHS ${value.toLocaleString()}`;
};

const featureCards = [
  {
    span: 'md:col-span-5',
    icon: IconStudent,
    tag: 'Records',
    title: 'Student Management',
    desc: 'Enroll students, manage profiles, guardians, classes, and academic records from one clean workspace.',
    visual: 'bars' as const,
  },
  {
    span: 'md:col-span-7',
    icon: IconChart,
    tag: 'Live intelligence',
    title: 'Real-time Dashboards',
    desc: 'School leaders see the state of students, attendance, fees, staff, and reports without spreadsheet chasing.',
    dark: true,
    visual: 'stats' as const,
  },
  {
    span: 'md:col-span-4',
    icon: IconWallet,
    tag: 'Finance',
    title: 'Fees & Finance',
    desc: 'Track collections, issue receipts, monitor balances, record income, and manage expenses.',
    visual: 'chart' as const,
  },
  {
    span: 'md:col-span-4',
    icon: IconClock,
    tag: 'Daily ops',
    title: 'Attendance',
    desc: 'Teachers mark attendance quickly while administrators keep clean daily visibility.',
  },
  {
    span: 'md:col-span-4',
    icon: IconGrade,
    tag: 'Academics',
    title: 'Grading',
    desc: 'Capture assessment scores, build report cards, and release term results to parents.',
  },
  {
    span: 'md:col-span-4',
    icon: Building2,
    tag: 'Boarding',
    title: 'Boarding House Management',
    desc: 'Complete boarding management — boys and girls dorms, room and bed assignments, exeat tracking, nightly roll call, feeding attendance, sick bay, and boarding fees auto-applied to student bills.',
  },
  {
    span: 'md:col-span-4',
    icon: IconPhone,
    tag: 'Parent connection',
    title: 'Parent PWA',
    desc: 'Parents open a no-download portal for receipts, fee status, report cards, attendance alerts, and learning mode.',
    visual: 'notifications' as const,
  },
  {
    span: 'md:col-span-4',
    icon: IconShield,
    tag: 'Trust',
    title: 'Security & Privacy',
    desc: 'Tenant-aware architecture keeps each school isolated, with role-based access and audit-ready activity logs.',
  },
];

type FeaturesSectionProps = {
  stats: PublicStats;
  /** Standalone SEO page uses h1; homepage section uses h2 */
  pageTitle?: string;
  embedded?: boolean;
};

export default function FeaturesSection({ stats, pageTitle, embedded = false }: FeaturesSectionProps) {
  const HeadingTag = embedded ? 'h2' : 'h1';
  const heading = pageTitle ?? 'Everything your school needs, built in.';

  return (
    <section id={embedded ? 'features' : undefined} className="scholar-section bg-[var(--surface-2)] px-4 sm:px-5">
      <div className="mx-auto max-w-[1100px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="scholar-eyebrow">Features</p>
          <HeadingTag className="scholar-display scholar-section-title text-[var(--ink)]">{heading}</HeadingTag>
          <p className="mt-4 text-[var(--ink-muted)]">
            ScholarNerve brings admin, teachers, finance teams, and parents into one polished operating system.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-12">
          {featureCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`scroll-reveal scholar-feature-card group ${card.span} ${card.dark ? 'is-dark' : ''}`}
                style={{ '--reveal-delay': `${index * 80}ms` } as React.CSSProperties}
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${card.dark ? 'bg-[var(--brand)] text-white shadow-lg shadow-emerald-900/30' : 'bg-[var(--brand-light)] text-[var(--brand)]'}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className={`mb-2 text-xs font-bold uppercase tracking-[0.18em] ${card.dark ? 'text-[var(--brand-light)]' : 'text-[var(--brand)]'}`}>{card.tag}</p>
                <h3 className="scholar-display text-2xl font-bold">{card.title}</h3>
                <p className={`mt-3 text-sm leading-6 ${card.dark ? 'text-white/70' : 'text-[var(--ink-muted)]'}`}>{card.desc}</p>

                {card.visual === 'bars' && (
                  <div className="mt-7 flex gap-2">
                    {[30, 62, 45, 78, 52].map((height) => (
                      <span key={height} className="flex-1 rounded-full bg-[var(--brand)]/20 p-1">
                        <span className="block rounded-full bg-[var(--brand)]" style={{ height: `${height}px` }} />
                      </span>
                    ))}
                  </div>
                )}
                {card.visual === 'stats' && (
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Students', formatCount(stats.students)],
                      ['Attendance', 'Tracked'],
                      ['Fees', formatMoney(stats.feesProcessed)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                        <p className="text-xs text-white/45">{label}</p>
                        <p className="scholar-display mt-1 text-xl font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {card.visual === 'chart' && (
                  <div className="mt-8 flex h-24 items-end gap-2">
                    {[35, 58, 44, 76, 62, 88, 54].map((height, i) => (
                      <span
                        key={`${height}-${i}`}
                        className={`w-full rounded-t-xl ${i % 2 ? 'bg-[var(--surface-3)]' : 'bg-[var(--brand)]'}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                )}
                {card.visual === 'notifications' && (
                  <div className="mt-7 flex flex-wrap gap-2">
                    {[
                      ['Fee Receipt Issued', 'bg-emerald-500'],
                      ['Term Report Ready', 'bg-purple-500'],
                      ['1 Absence Recorded', 'bg-amber-500'],
                    ].map(([label, dot]) => (
                      <span key={label} className="rounded-[var(--radius-pill)] border border-[var(--sn-border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)]">
                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${dot}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
