import React from 'react';
import {
  Award, Briefcase, CalendarDays, GraduationCap, Image as ImageIcon, Mail, UserRound,
} from 'lucide-react';
import { getSchoolWebsitePublicUrl } from '@/utils/schoolWebsiteHost';

const DEMO_SLUG = 'light-preparatory';
const DEMO_SCHOOL = 'Light Preparatory School';
const DEMO_URL = getSchoolWebsitePublicUrl(DEMO_SLUG);

const PAGES = [
  {
    icon: GraduationCap,
    title: 'Admissions',
    body: 'Parents apply online with documents, class choice, and guardian details — you review every application in one inbox.',
  },
  {
    icon: Award,
    title: 'Alumni',
    body: 'Spotlight graduates and let alumni request transcripts, BECE results, and testimonial letters digitally.',
  },
  {
    icon: Briefcase,
    title: 'Careers',
    body: 'Teachers and staff apply with CVs and certificates. Open or close hiring seasons from your dashboard.',
  },
  {
    icon: CalendarDays,
    title: 'Events',
    body: 'Publish open days, sports days, and ceremonies. Upcoming events show on your homepage automatically.',
  },
  {
    icon: ImageIcon,
    title: 'Gallery',
    body: 'Show classrooms, labs, and school life — help families see what makes your school special before they visit.',
  },
  {
    icon: UserRound,
    title: 'Management',
    body: 'Introduce proprietors, head teachers, and leadership with photos and bios parents can trust.',
  },
  {
    icon: Mail,
    title: 'Contact',
    body: 'Enquiries from your contact page land in ScholarNerve with read/unread tracking — nothing gets lost.',
  },
];

export default function SchoolWebsiteShowcase() {
  return (
    <section id="school-website" className="scholar-section bg-[var(--surface-2)] px-4 sm:px-5">
      <div className="mx-auto max-w-[1100px]">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          <div className="scroll-reveal">
            <p className="scholar-eyebrow">Included in ScholarNerve</p>
            <h2 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
              Your school&apos;s own professional website
            </h2>
            <p className="mt-4 text-base font-light leading-7 text-[var(--ink-muted)]">
              Every school on ScholarNerve can launch a beautiful public site — your logo, colours, and story on the web.
              Admissions, alumni, careers, events, and more, all managed from the same platform you already use.
            </p>
            <p className="mt-3 text-sm text-[var(--ink-subtle)]">
              Live example:{' '}
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--brand-dark)] underline-offset-2 hover:underline"
              >
                {DEMO_SCHOOL}
              </a>
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {PAGES.slice(0, 4).map((page, i) => (
                <div
                  key={page.title}
                  className="scroll-reveal sn-school-website-card rounded-2xl border border-[var(--sn-border)] bg-white/90 p-4 shadow-sm"
                  style={{ '--reveal-delay': `${180 + i * 70}ms` } as React.CSSProperties}
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0c2340]/8 text-[#0c2340]">
                    <page.icon className="h-4 w-4" />
                  </div>
                  <p className="font-bold text-[var(--ink)]">{page.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{page.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="scroll-reveal" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
            <div className="sn-school-website-mock">
              <div className="overflow-hidden rounded-[22px] border border-[#0c2340]/15 bg-white shadow-[0_24px_60px_rgba(12,35,64,0.18)]">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-[#f4f6f8] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <div className="ml-2 min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-[10px] text-slate-500">
                  {DEMO_URL.replace(/^https?:\/\//, '')}
                </div>
              </div>

              <img
                src="/landing/school-website-hero.png"
                alt={`${DEMO_SCHOOL} website homepage`}
                className="block w-full"
                loading="lazy"
              />

              <div className="border-t border-[#e8e8e4] bg-white">
                <img
                  src="/landing/school-website-leadership.png"
                  alt={`Leadership message from ${DEMO_SCHOOL} — Ebenezer Acquah, Proprietor`}
                  className="block w-full"
                  loading="lazy"
                />
              </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGES.slice(4).map((page, i) => (
            <div
              key={page.title}
              className="scroll-reveal sn-school-website-card flex gap-3 rounded-2xl border border-[var(--sn-border)] bg-white/90 p-4 shadow-sm"
              style={{ '--reveal-delay': `${460 + i * 60}ms` } as React.CSSProperties}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0c2340]/8 text-[#0c2340]">
                <page.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-[var(--ink)]">{page.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{page.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
