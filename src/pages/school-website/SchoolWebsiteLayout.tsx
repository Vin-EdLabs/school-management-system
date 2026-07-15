import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronRight, Facebook, Instagram, Linkedin, Mail, MapPin, Menu, Phone, Share2, Twitter, X, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from './SchoolWebsiteContext';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/admissions', label: 'Admissions' },
  { to: '/events', label: 'Events' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/careers', label: 'Careers' },
  { to: '/alumni', label: 'Alumni' },
  { to: '/contact', label: 'Contact' },
];

/* ------------------------------------------------------------------ */
/* Scroll reveal — IntersectionObserver fade-up                        */
/* ------------------------------------------------------------------ */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('sw-reveal', visible && 'is-visible', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */
function Navbar() {
  const { accent, schoolName, data } = useSchoolWebsite();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const logo = resolveWebsiteImageUrl(data?.website?.logo_url);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <header className={cn('sw-navbar', scrolled && 'is-scrolled')}>
      <div className="sw-container flex items-center justify-between gap-4 py-4">
        <Link to="/" className="sw-brand flex min-w-0 max-w-[58%] items-center gap-2 no-underline sm:max-w-[65%] sm:gap-3 md:max-w-none">
          {logo ? (
            <img src={logo} alt={`${schoolName} logo`} className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-11 sm:w-11" />
          ) : (
            <div
              className="sw-serif flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white sm:h-11 sm:w-11 sm:text-xl"
              style={{ backgroundColor: accent }}
            >
              {schoolName.slice(0, 1)}
            </div>
          )}
          <span className="sw-brand-name sw-serif truncate" style={{ color: accent }} title={schoolName}>
            {schoolName}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('sw-nav-link', isActive && 'active')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link to="/admissions" className="sw-btn sw-btn-primary !py-2.5 !px-6 text-sm">
            Apply Now
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg border p-2 md:hidden"
          style={{ borderColor: 'var(--sw-border)', color: 'var(--sw-navy-light)' }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="sw-mobile-nav border-t bg-white px-5 pb-8 pt-4 md:hidden" style={{ borderColor: 'var(--sw-border)' }}>
          <div className="flex flex-col">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'border-b py-4 text-base font-medium no-underline',
                    isActive ? 'font-semibold' : ''
                  )
                }
                style={({ isActive }) => ({
                  borderColor: 'var(--sw-border)',
                  color: isActive ? accent : 'var(--sw-navy-light)',
                })}
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/admissions" className="sw-btn sw-btn-primary mt-6 w-full">
              Apply Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
const SOCIAL_ICONS: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  tiktok: Share2,
};

function Footer() {
  const { accent, schoolName, data } = useSchoolWebsite();
  const logo = resolveWebsiteImageUrl(data?.website?.logo_url);
  const contact = data?.contact || {};
  const socials = Object.entries(data?.website?.social_links || {}).filter(([, url]) => url);
  const location = contact.address ? String(contact.address) : '';
  const email = contact.email ? String(contact.email) : '';

  return (
    <footer className="sw-footer sw-on-navy mt-auto" style={{ background: 'var(--sw-navy)' }}>
      <div className="sw-container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20" />
            ) : (
              <div className="sw-serif flex h-10 w-10 items-center justify-center rounded-full text-lg text-white ring-2 ring-white/20" style={{ backgroundColor: accent }}>
                {schoolName.slice(0, 1)}
              </div>
            )}
            <p className="sw-serif text-xl text-white">{schoolName}</p>
          </div>
          {data?.website?.tagline && (
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{data.website.tagline}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--sw-gold)]">Quick Links</p>
          <div className="mt-5 flex flex-col gap-3 text-sm">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="no-underline text-white/85 transition hover:text-[var(--sw-gold)]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--sw-gold)]">Contact</p>
          <div className="mt-5 space-y-3 text-sm text-white/85">
            {contact.primary_phone && (
              <p className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sw-gold)]" />
                {String(contact.primary_phone)}
              </p>
            )}
            {email && (
              <p className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sw-gold)]" />
                <a href={`mailto:${email}`} className="no-underline text-white/85 transition hover:text-[var(--sw-gold)]">
                  {email}
                </a>
              </p>
            )}
            {location && (
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sw-gold)]" />
                {location}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--sw-gold)]">Follow Us</p>
          <div className="mt-5 flex gap-3">
            {socials.length > 0 ? (
              socials.map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key.toLowerCase()] || Facebook;
                return (
                  <a
                    key={key}
                    href={String(url)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={key}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[var(--sw-gold)] transition hover:-translate-y-0.5 hover:bg-white/20"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="sw-container flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/55 sm:flex-row">
          <span>© {new Date().getFullYear()} {schoolName}. All rights reserved.</span>
          {(location || email) && (
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-5">
              {location && (
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--sw-gold)]" />
                  {location}
                </span>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 no-underline text-white/70 transition hover:text-[var(--sw-gold)]"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--sw-gold)]" />
                  {email}
                </a>
              )}
            </div>
          )}
          <span>Powered by ScholarNerve</span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page hero (About / Admissions / Gallery / Contact)                  */
/* ------------------------------------------------------------------ */
export function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  const { schoolName } = useSchoolWebsite();
  return (
    <section
      className="sw-page-hero sw-on-navy sw-gold-pattern relative overflow-hidden"
      style={{ background: 'var(--sw-navy)' }}
    >
      <div className="sw-container relative py-20 md:py-24">
        <nav className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-white/70">
          <Link to="/" className="no-underline text-white/70 transition hover:text-white">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span style={{ color: 'var(--sw-gold)' }}>{title}</span>
        </nav>
        <h1 className="sw-serif mt-4 text-4xl !text-white md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">{subtitle}</p>}
        <p className="sw-serif mt-6 text-lg italic text-white/60">{schoolName}</p>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  centered,
  light,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  centered?: boolean;
  light?: boolean;
}) {
  return (
    <div className={cn('mb-14', centered && 'text-center')}>
      {eyebrow && <p className={cn('sw-eyebrow', light && '!text-[var(--sw-gold)]')}>{eyebrow}</p>}
      <h2 className={cn('sw-serif mt-3 text-4xl leading-tight md:text-5xl', light && '!text-white')}>{title}</h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function SchoolWebsiteLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
