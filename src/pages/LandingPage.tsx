import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import ParentAppShowcase from '../components/landing/ParentAppShowcase';
import SchoolWebsiteShowcase from '../components/landing/SchoolWebsiteShowcase';
import PricingSection from '../components/landing/PricingSection';
import ContactSection from '../components/landing/ContactSection';
import FeaturesSection, { type PublicStats } from '../components/landing/FeaturesSection';
import AboutSection from '../components/landing/AboutSection';
import ScrollToTopButton from '../components/landing/ScrollToTopButton';
import LandingHeader from '../components/landing/LandingHeader';
import LandingBrandMark from '../components/landing/LandingBrandMark';
import { LandingStructuredData } from '../components/landing/LandingStructuredData';
import { REGISTER_SCHOOL_PATH, scrollToHashSection } from '@/utils/landingScroll';

type LegalDocKey = 'privacy' | 'terms';

type LegalSection = {
  title: string;
  body?: string;
  items?: string[];
};

type LegalDocument = {
  title: string;
  eyebrow: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
};

const defaultStats: PublicStats = {
  schools: 0,
  students: 0,
  teachersAndStaff: 0,
  feesProcessed: 0,
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const BrandMark = LandingBrandMark;

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="scholar-eyebrow">{children}</p>
);

const CheckItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-3 text-sm text-[var(--ink-muted)]">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)] text-[var(--brand)]">
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="m2.5 6.1 2.1 2.1 4.9-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    {children}
  </li>
);

const legalDocuments: Record<LegalDocKey, LegalDocument> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'ScholarNerve Legal',
    effectiveDate: 'June 2026',
    intro: [
      'ScholarNerve ("ScholarNerve", "we", "our", or "us") provides a cloud-based school management platform designed for educational institutions to manage academic, administrative, and operational activities.',
      'This Privacy Policy explains how we collect, use, store, and protect information when schools, teachers, parents, students, and authorized users access our services.',
      'By accessing or using ScholarNerve, you acknowledge that you have read and understood this Policy.',
    ],
    sections: [
      {
        title: '1. Information We Collect',
        body: 'We collect information necessary to operate, secure, and improve the platform, including:',
        items: [
          'Student information: name, student ID, academic records, attendance, and class details.',
          'Parent or guardian information: contact details and relationship data.',
          'Staff information: teacher, administrator, and school staff profiles.',
          'Institutional data: school records, timetables, grading structures, and related academic data.',
          'Usage data: log data, device information, IP address, and system interactions.',
          'Transactional data: fee records and payment history where enabled by the institution.',
        ],
      },
      {
        title: '2. Purpose of Processing',
        body: 'We process personal data strictly to deliver core platform functionality, support academic and administrative workflows, facilitate communication between authorized users, generate institutional reporting, and maintain system security and performance. We do not sell, lease, or monetize personal data.',
      },
      {
        title: '3. Data Access and Disclosure',
        body: 'Access to data is strictly controlled and limited to designated school administrators, authorized teaching staff, students, and parents as permitted by the institution. We may disclose information only where required by applicable law, regulation, or valid legal process.',
      },
      {
        title: '4. Data Security',
        body: 'We implement safeguards designed to protect information against unauthorized access, alteration, disclosure, or destruction, including role-based access control, secure authentication, encrypted communication channels where applicable, and ongoing system monitoring. No digital system can guarantee absolute security.',
      },
      {
        title: '5. Data Retention',
        body: 'Data is retained for as long as the institution maintains an active ScholarNerve account. Upon termination or formal request by the institution, data may be deleted or exported, subject to legal or contractual obligations.',
      },
      {
        title: '6. Data Rights',
        body: 'Subject to institutional control and applicable law, users may request access, correction, deletion, or export of data through their designated school administrator.',
      },
      {
        title: '7. Changes to This Policy',
        body: 'We may revise this Privacy Policy from time to time to reflect changes in technology, legal requirements, or service improvements. Updates will be published with a revised effective date.',
      },
      {
        title: '8. Contact',
        body: 'For privacy inquiries, contact ScholarNerve at scholarnerve@gmail.com or visit https://scholarnerve.com/.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'ScholarNerve Legal',
    effectiveDate: 'June 2026',
    intro: [
      'These Terms of Service ("Terms") govern access to and use of the ScholarNerve platform and related services.',
      'By accessing or using ScholarNerve, you agree to be bound by these Terms.',
    ],
    sections: [
      {
        title: '1. Service Overview',
        body: 'ScholarNerve is a software-as-a-service platform designed to support educational institutions in managing academic, administrative, finance, and communication processes. Access is provided exclusively to authorized institutions and their designated users.',
      },
      {
        title: '2. Account Access and Responsibility',
        body: 'User accounts are provisioned and managed by the educational institution. Each institution is responsible for managing permissions, maintaining secure account practices, and ensuring appropriate platform use. Users are responsible for keeping credentials confidential.',
      },
      {
        title: '3. Acceptable Use',
        body: 'Users agree not to:',
        items: [
          'Interfere with or disrupt system integrity or performance.',
          'Attempt unauthorized access to data or system components.',
          'Misrepresent identity, academic records, or institutional information.',
          'Use the platform for unlawful, abusive, or unauthorized purposes.',
        ],
      },
      {
        title: '4. Institutional Responsibility',
        body: 'Each institution is responsible for the accuracy and legality of data entered into the system, compliance with applicable educational and data protection regulations, and internal governance of user roles and permissions. ScholarNerve acts as a data processor on behalf of institutions.',
      },
      {
        title: '5. Availability of Service',
        body: 'While we aim to maintain high availability and reliability, access to ScholarNerve may be interrupted due to maintenance, updates, or unforeseen technical issues. We do not guarantee uninterrupted or error-free operation.',
      },
      {
        title: '6. Limitation of Liability',
        body: 'To the maximum extent permitted by law, ScholarNerve shall not be liable for indirect, incidental, or consequential damages, data loss resulting from user or institutional actions, service interruptions beyond reasonable control, or decisions made based on system-generated data.',
      },
      {
        title: '7. Termination',
        body: 'We may suspend or terminate access if these Terms are violated, security risks or misuse are detected, or an institution requests account deactivation. Upon termination, data will be handled according to the Privacy Policy.',
      },
      {
        title: '8. Amendments',
        body: 'We may update or modify these Terms periodically. Continued use of the platform constitutes acceptance of any revised Terms.',
      },
      {
        title: '9. Contact Information',
        body: 'For terms or service inquiries, contact ScholarNerve at scholarnerve@gmail.com or visit https://scholarnerve.com/.',
      },
    ],
  },
};

const LandingPage = () => {
  const [stats, setStats] = useState<PublicStats>(defaultStats);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/tenant/public-stats`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Partial<PublicStats> | null) => {
        if (cancelled || !data) return;
        setStats({
          schools: Number(data.schools ?? 0),
          students: Number(data.students ?? 0),
          teachersAndStaff: Number(data.teachersAndStaff ?? 0),
          feesProcessed: Number(data.feesProcessed ?? 0),
        });
      })
      .catch(() => {
        // Public stats are nice-to-have; the landing page must still render without the API.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeLegalDoc) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveLegalDoc(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeLegalDoc]);

  useEffect(() => {
    const visitorStorageKey = 'scholarnerve_landing_visitor_id';

    try {
      let visitorId = localStorage.getItem(visitorStorageKey);
      if (visitorId) return;

      visitorId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      localStorage.setItem(visitorStorageKey, visitorId);
      fetch(`${API_BASE}/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, page: 'landing' }),
      }).catch(() => {
        // Visitor tracking should never interrupt the public landing page.
      });
    } catch {
      // localStorage may be blocked; ignore visitor tracking in that browser.
    }
  }, []);

  useEffect(() => {
    const scrollToHash = () => {
      if (!window.location.hash) return;
      window.setTimeout(() => scrollToHashSection(), 80);
    };

    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
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
      { threshold: 0.15 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="scholar-landing min-h-screen overflow-x-hidden">
      <LandingStructuredData />
      <LandingHeader brandMark={<BrandMark className="h-full w-full" />} />

      <main className="pt-14 sm:pt-16">
        <section className="scholar-hero-bg relative flex min-h-[calc(100dvh-64px)] items-center px-4 pb-14 pt-12 sm:px-5 sm:pb-16 sm:pt-16">
          <div className="relative mx-auto w-full max-w-[1100px] text-center">
            <div
              className="scholar-fade-up mx-auto mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--sn-border)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--brand-dark)] shadow-sm backdrop-blur"
              style={{ animationDelay: '0s' }}
            >
              <span className="scholar-pulse-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
              Africa&apos;s Complete School Platform
            </div>

            <h1
              className="scholar-display scholar-fade-up scholar-section-title mx-auto max-w-4xl text-[var(--ink)]"
              style={{ animationDelay: '0.1s' }}
            >
              Run your school{' '}
              <span className="relative inline-block bg-gradient-to-r from-[var(--brand)] via-teal-500 to-[var(--brand-dark)] bg-clip-text text-transparent">
                smarter
              </span>{' '}
              — not harder.
            </h1>

            <p
              className="scholar-fade-up mx-auto mt-5 max-w-[580px] text-base font-light leading-7 text-[var(--ink-muted)] sm:mt-6 sm:text-[1.08rem] sm:leading-8"
              style={{ animationDelay: '0.2s' }}
            >
              ScholarNerve is a school management system for JHS and primary schools in Ghana covering student records,
              fee collection, attendance, grading, report cards, and parent communication in one secure platform.
            </p>

            <div
              className="scholar-fade-up mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center sm:flex-wrap"
              style={{ animationDelay: '0.3s' }}
            >
              <Link to={REGISTER_SCHOOL_PATH} className="scholar-btn-primary">
                Register Your School →
              </Link>
              <Link to="/partners" className="scholar-btn-partner">
                Become a Partner
              </Link>
              <a href="#features" className="scholar-btn-secondary">
                See how it works
              </a>
            </div>

            <div
              className="scholar-fade-up mt-7 flex flex-col items-center justify-center gap-3 sm:mt-8"
              style={{ animationDelay: '0.38s' }}
            >
              <div className="scholar-trust-pill">
                <div className="flex -space-x-2">
                  {['SN', 'GH', 'PW', 'ED'].map((initials, index) => (
                    <span
                      key={initials}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: ['#0D9E75', '#085041', '#1D9E75', '#63C5A3'][index] }}
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <span className="text-left leading-snug">
                  Trusted by Light Preparatory, Victory International &amp; Rosa Gardens School Accra
                </span>
              </div>
            </div>

            <div
              className="scholar-fade-up scholar-browser-frame mx-auto mt-10 max-w-[1040px] text-left sm:mt-12"
              style={{ animationDelay: '0.52s', animationDuration: '0.8s' }}
            >
              <div className="overflow-hidden rounded-[22px] border border-emerald-950/10 bg-white">
                <div className="flex items-center gap-3 bg-[var(--surface-2)] px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                    <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="mx-auto flex w-full max-w-[430px] items-center gap-2 rounded-[var(--radius-pill)] bg-white px-4 py-1.5 text-xs text-[var(--ink-subtle)] shadow-inner">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="m14.2 14.2 3 3M8.8 15.4a6.6 6.6 0 1 1 0-13.2 6.6 6.6 0 0 1 0 13.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span className="truncate">school.scholarnerve.com</span>
                  </div>
                </div>

                <div className="relative bg-[var(--surface-3)] p-4 md:p-6">
                  <img
                    src="/scholarnerve-dashboard-preview.png"
                    alt="ScholarNerve dashboard preview"
                    className="h-auto w-full rounded-[16px] border border-emerald-950/10 object-contain shadow-[0_18px_45px_rgba(15,26,20,0.16)]"
                  />
                  <div className="pointer-events-none absolute inset-x-6 bottom-3 h-14 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(8,80,65,0.18),transparent_70%)] blur-2xl" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="scholar-section bg-white px-4 sm:px-5">
          <div className="mx-auto grid max-w-[1100px] items-center gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="scroll-reveal">
              <SectionLabel>Financial Analytics</SectionLabel>
              <h2 className="scholar-display scholar-section-title text-[var(--ink)]">
                See every cedi moving through your school.
              </h2>
              <p className="mt-5 text-[var(--ink-muted)] leading-7">
                Track fees collected, other income, expenses, net balances, and monthly trends from a polished finance view built for school administrators.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {['Fees collected', 'Other income', 'Expenses trend', 'Outstanding balances'].map((item) => (
                  <div key={item} className="rounded-2xl border border-[var(--sn-border)] bg-[var(--surface-2)] px-4 py-3.5 text-sm font-semibold text-[var(--ink-muted)] shadow-sm">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--brand)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="scroll-reveal scholar-browser-frame border-[var(--brand-dark)]/20 bg-[var(--ink)] p-3 shadow-[0_30px_80px_rgba(8,80,65,0.24)]" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#030b16]">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                    <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="mx-auto flex w-full max-w-[360px] items-center gap-2 rounded-full bg-white/[0.08] px-4 py-1.5 text-xs text-white/55">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="m14.2 14.2 3 3M8.8 15.4a6.6 6.6 0 1 1 0-13.2 6.6 6.6 0 0 1 0 13.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span className="truncate">school.scholarnerve.com/financial</span>
                  </div>
                </div>
                <img
                  src="/scholarnerve-financial-preview-dark.png"
                  alt="ScholarNerve dark financial dashboard preview"
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <FeaturesSection stats={stats} embedded />

        <ParentAppShowcase />

        <SchoolWebsiteShowcase />

        <PricingSection />

        <ContactSection />

        <section className="scholar-section bg-[var(--surface-2)] px-4 sm:px-5">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Testimonials</SectionLabel>
              <h2 className="scholar-display scholar-section-title text-[var(--ink)]">
                Schools already trust the ScholarNerve experience.
              </h2>
              <p className="mt-4 text-[var(--ink-muted)]">
                Real school workflows, premium support, and a platform designed around Ghanaian school operations.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  school: 'Light Preparatory School',
                  role: 'School Leadership',
                  quote:
                    'ScholarNerve has completely streamlined how we run Light Preparatory. Admissions, student records, fees, and daily administration are now managed in one reliable platform our team can fully depend on. It has brought real structure, clarity, and efficiency to our operations. Parents love the app.',
                  image: '/light-preparatory-testimonial.png',
                },
                {
                  school: 'Victory International',
                  role: 'School Management Team',
                  quote:
                    'The parent and teacher portals make communication easier, while the dashboard keeps leadership informed without waiting for manual updates.',
                  visual: 'gradient',
                },
                {
                  school: 'Rosa Gardens School Accra',
                  role: 'Administrator',
                  quote:
                    'ScholarNerve gives our team a cleaner way to manage reports, fees, student records, and daily school operations from one secure dashboard.',
                  visual: 'lines',
                },
              ].map((item, index) => (
                <article
                  key={item.school}
                  className="scroll-reveal overflow-hidden rounded-[28px] border border-[var(--sn-border)] bg-white shadow-[0_22px_60px_rgba(8,80,65,0.10)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--sn-border-strong)]"
                  style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties}
                >
                  <div className="flex min-h-full flex-col">
                    <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[var(--brand-light)] p-2 sm:h-52">
                      {'image' in item ? (
                        <img src={item.image} alt={item.school} className="max-h-full w-full rounded-2xl object-contain" />
                      ) : item.visual === 'gradient' ? (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(225,245,238,0.95),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(13,158,117,0.45),transparent_30%),linear-gradient(135deg,#085041,#0D9E75_45%,#E1F5EE)]" />
                      ) : (
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f6faf8,#e1f5ee)]">
                          <div className="absolute inset-0 opacity-80 [background-image:repeating-linear-gradient(135deg,rgba(13,158,117,0.0)_0px,rgba(13,158,117,0.0)_18px,rgba(13,158,117,0.28)_19px,rgba(13,158,117,0.28)_21px)]" />
                          <div className="absolute -left-12 top-8 h-32 w-32 rounded-full bg-[var(--brand)]/20 blur-2xl" />
                          <div className="absolute -right-10 bottom-5 h-36 w-36 rounded-full bg-[var(--brand-dark)]/15 blur-2xl" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/25 to-transparent" />
                    </div>
                    <div className="flex flex-1 flex-col p-5 md:p-6">
                      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-light)] text-xl text-[var(--brand)] md:mb-5 md:h-11 md:w-11 md:rounded-2xl md:text-2xl">
                        &ldquo;
                      </div>
                      <p className="text-sm font-light leading-6 text-[var(--ink-muted)] md:text-base md:leading-7">{item.quote}</p>
                      <div className="mt-auto border-t border-[var(--sn-border)] pt-4 md:pt-5">
                        <p className="scholar-display text-lg font-bold text-[var(--ink)]">{item.school}</p>
                        <p className="mt-1 text-sm text-[var(--ink-subtle)]">{item.role}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <AboutSection embedded />
      </main>

      <footer className="bg-[var(--ink)] px-4 pb-8 pt-14 text-white sm:px-5">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid gap-10 border-t border-white/[0.08] pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-white ring-1 ring-white/20">
                  <BrandMark className="h-full w-full" />
                </span>
                <span className="scholar-display text-xl font-bold">ScholarNerve</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
                Africa&apos;s complete school management platform, built for Ghana and beyond.
              </p>
            </div>

            <div>
              <p className="mb-4 text-sm font-bold text-white">Explore</p>
              <div className="space-y-3">
                {[
                  ['/features', 'Features'],
                  ['/#parent-app', 'Mobile App'],
                  ['/pricing', 'Pricing'],
                  ['/contact', 'Contact'],
                  ['/about', 'About'],
                  ['/#school-website', 'School Website'],
                  ['/partners', 'Partners'],
                ].map(([href, label]) =>
                  href.startsWith('/#') || href.startsWith('#') ? (
                    <a key={href} href={href} className="block text-sm text-white/50 transition-colors hover:text-white">
                      {label}
                    </a>
                  ) : href.startsWith('/') ? (
                    <Link key={href} to={href} className="block text-sm text-white/50 transition-colors hover:text-white">
                      {label}
                    </Link>
                  ) : (
                    <a key={href} href={href} className="block text-sm text-white/50 transition-colors hover:text-white">
                      {label}
                    </a>
                  )
                )}
              </div>
            </div>

            <div>
              <p className="mb-4 text-sm font-bold text-white">Legal</p>
              <div className="space-y-3">
                <button type="button" onClick={() => setActiveLegalDoc('privacy')} className="block text-left text-sm text-white/50 transition-colors hover:text-white">
                  Privacy Policy
                </button>
                <button type="button" onClick={() => setActiveLegalDoc('terms')} className="block text-left text-sm text-white/50 transition-colors hover:text-white">
                  Terms of Service
                </button>
              </div>
            </div>
            <div>
              <p className="mb-4 text-sm font-bold text-white">Support</p>
              <div className="space-y-3">
                <Link to="/contact" className="block text-sm text-white/50 transition-colors hover:text-white">
                  Contact Us
                </Link>
                <a href="#" className="block text-sm text-white/50 transition-colors hover:text-white">
                  Status
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-sm text-white/50 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} ScholarNerve. All rights reserved.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <a href="mailto:scholarnerve@gmail.com" className="flex items-center gap-2 hover:text-white">
                <Mail className="h-4 w-4" />
                scholarnerve@gmail.com
              </a>
              <a href="https://wa.me/233531932399" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4" />
                WhatsApp: 053 193 2399
              </a>
              <a href="tel:+233506741322/tel:+233557609106" className="flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4" />
                Call: 050 674 1322/055 760 9106
              </a>
            </div>
          </div>
        </div>
      </footer>
      {activeLegalDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/70 px-4 py-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
          <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_34px_100px_rgba(0,0,0,0.35)]">
            <div className="relative overflow-hidden bg-[var(--ink)] px-6 pb-8 pt-8 text-white md:px-8 md:pt-9">
              <div className="absolute right-0 top-0 h-44 w-44 translate-x-1/3 -translate-y-1/3 rounded-full bg-[var(--brand)]/30 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-light)]">{legalDocuments[activeLegalDoc].eyebrow}</p>
                  <h2 id="legal-modal-title" className="scholar-display mt-3 pb-1 text-3xl font-extrabold leading-[1.12] md:text-4xl">
                    {legalDocuments[activeLegalDoc].title}
                  </h2>
                  <p className="mt-2 text-sm text-white/55">Effective Date: {legalDocuments[activeLegalDoc].effectiveDate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLegalDoc(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="Close legal document"
                >
                  X
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-6 md:px-8">
              <div className="space-y-4 rounded-2xl border border-[var(--sn-border)] bg-[var(--surface-2)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
                {legalDocuments[activeLegalDoc].intro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-6 space-y-5">
                {legalDocuments[activeLegalDoc].sections.map((section) => (
                  <section key={section.title} className="rounded-2xl border border-[var(--sn-border)] bg-white p-5">
                    <h3 className="scholar-display text-xl font-bold text-[var(--ink)]">{section.title}</h3>
                    {section.body && <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{section.body}</p>}
                    {section.items && (
                      <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
                        {section.items.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
};

export default LandingPage;
