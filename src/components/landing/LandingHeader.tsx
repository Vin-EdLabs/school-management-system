import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { getScholarNerveMainUrl, getPartnersPortalLoginUrl, isPartnersHost } from '@/utils/partnersHost';
import { REGISTER_SCHOOL_PATH, handleRegisterNavClick } from '@/utils/landingScroll';

const HOME_NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#parent-app', label: 'Mobile App' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
  { href: '/#school-website', label: 'School Website' },
] as const;

const PARTNERS_NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#earnings', label: 'Earnings' },
  { href: '#tiers', label: 'Tiers' },
  { href: '#apply', label: 'Apply' },
] as const;

type LandingHeaderProps = {
  brandMark: React.ReactNode;
  /** partners = section nav + Apply Now CTA */
  variant?: 'home' | 'partners';
  /** When set, replaces the default square mark + ScholarNerve wordmark (e.g. Partners logo lockup). */
  brandLockup?: React.ReactNode;
  brandHref?: string;
};

export default function LandingHeader({ brandMark, variant = 'home', brandLockup, brandHref = '/' }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isPartners = variant === 'partners';
  const navLinks = isPartners ? PARTNERS_NAV : HOME_NAV;
  const mainSiteUrl = getScholarNerveMainUrl();
  const partnerLoginUrl = getPartnersPortalLoginUrl();
  const onPartnerSubdomain = isPartnersHost();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const goHome = useCallback((e?: React.MouseEvent) => {
    closeMenu();
    if (onPartnerSubdomain) {
      e?.preventDefault();
      window.location.href = mainSiteUrl;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [closeMenu, mainSiteUrl, onPartnerSubdomain]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen, closeMenu]);

  const scrollToApply = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onRegisterClick = (e: React.MouseEvent) => {
    handleRegisterNavClick(e, location.pathname, closeMenu);
  };

  return (
    <header className="scholar-landing-header fixed left-0 right-0 top-0 z-[100]">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-5">
        <Link to={brandHref} className="flex min-w-0 items-center gap-2 sm:gap-2.5" aria-label={isPartners ? 'ScholarNerve Partners home' : 'ScholarNerve home'}>
          {brandLockup ? (
            brandLockup
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md shadow-emerald-950/10 ring-1 ring-[var(--sn-border)] sm:h-9 sm:w-9 sm:rounded-xl">
                {brandMark}
              </span>
              <span className="scholar-display truncate text-base font-bold text-[var(--ink)] sm:text-lg">
                ScholarNerve
              </span>
            </>
          )}
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {isPartners && (
            onPartnerSubdomain ? (
              <a href={mainSiteUrl} className="scholar-nav-link inline-flex items-center gap-1 font-semibold text-[var(--brand-dark)]">
                <ArrowLeft className="h-3.5 w-3.5" />
                ScholarNerve
              </a>
            ) : (
              <Link to="/" onClick={goHome} className="scholar-nav-link inline-flex items-center gap-1 font-semibold text-[var(--brand-dark)]">
                <ArrowLeft className="h-3.5 w-3.5" />
                ScholarNerve
              </Link>
            )
          )}
          {isPartners && (
            <a href={partnerLoginUrl} className="snp-partner-login-nav-btn hidden md:inline-flex">
              Partner Login
            </a>
          )}
          {navLinks.map((link) =>
            'to' in link ? (
              <Link key={link.to} to={link.to} className="scholar-nav-link">
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className="scholar-nav-link">
                {link.label}
              </a>
            )
          )}
          {!isPartners && (
            <a href="/#partners" className="scholar-nav-link font-semibold text-[var(--brand-dark)]">
              Partners
            </a>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!isPartners && (
            <a
              href="/#partners"
              className="scholar-nav-partner-cta scholar-header-desktop-only"
            >
              Become a Partner
            </a>
          )}

          {isPartners ? (
            <a href="#apply" onClick={scrollToApply} className="scholar-nav-cta scholar-header-mobile-only">
              Apply Now
            </a>
          ) : (
            <Link to={REGISTER_SCHOOL_PATH} onClick={onRegisterClick} className="scholar-nav-cta scholar-header-mobile-only">
              Register
            </Link>
          )}

          {!isPartners && (
            <Link to={REGISTER_SCHOOL_PATH} onClick={onRegisterClick} className="scholar-nav-cta scholar-header-desktop-only">
              Register
            </Link>
          )}
          {isPartners && (
            <a href="#apply" onClick={scrollToApply} className="scholar-nav-cta scholar-header-desktop-only">
              Apply Now
            </a>
          )}

          <div ref={menuRef} className="scholar-mobile-menu-wrap relative">
            <button
              type="button"
              className="scholar-mobile-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              aria-haspopup="true"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Menu className="h-3.5 w-3.5" strokeWidth={2.25} />}
            </button>

            <nav
              id="landing-mobile-nav"
              className={`scholar-mobile-nav-dropdown ${menuOpen ? 'is-open' : ''}`}
              aria-label="Mobile"
              aria-hidden={!menuOpen}
            >
              <p className="scholar-mobile-nav-label">Menu</p>
              <div className="scholar-mobile-nav-links">
                {isPartners && (
                  onPartnerSubdomain ? (
                    <a
                      href={mainSiteUrl}
                      className="scholar-mobile-nav-link scholar-mobile-nav-link--back"
                      style={{ '--nav-delay': '0ms' } as React.CSSProperties}
                      onClick={closeMenu}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      ← Back to ScholarNerve
                    </a>
                  ) : (
                    <Link
                      to="/"
                      className="scholar-mobile-nav-link scholar-mobile-nav-link--back"
                      style={{ '--nav-delay': '0ms' } as React.CSSProperties}
                      onClick={goHome}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      ← Back to ScholarNerve
                    </Link>
                  )
                )}
                {navLinks.map((link, index) =>
                  'to' in link ? (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="scholar-mobile-nav-link"
                      style={{ '--nav-delay': `${index * 40}ms` } as React.CSSProperties}
                      onClick={closeMenu}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      className="scholar-mobile-nav-link"
                      style={{ '--nav-delay': `${index * 40}ms` } as React.CSSProperties}
                      onClick={closeMenu}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      {link.label}
                    </a>
                  )
                )}
                {!isPartners && (
                  <a
                    href="/#partners"
                    className="scholar-mobile-nav-link font-semibold text-[var(--brand-dark)]"
                    style={{ '--nav-delay': `${navLinks.length * 40}ms` } as React.CSSProperties}
                    onClick={closeMenu}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    Partners
                  </a>
                )}
                {isPartners && (
                  <a
                    href={partnerLoginUrl}
                    className="snp-partner-login-nav-btn w-full justify-center"
                    style={{ '--nav-delay': `${(navLinks.length + 1) * 40}ms` } as React.CSSProperties}
                    onClick={closeMenu}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    Partner Login
                  </a>
                )}
              </div>
              <div className="scholar-mobile-nav-footer space-y-2">
                {isPartners ? (
                  <a
                    href="#apply"
                    className="scholar-mobile-nav-cta"
                    onClick={scrollToApply}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    Apply Now
                  </a>
                ) : (
                  <>
                    <a
                      href="/#partners"
                      className="scholar-mobile-nav-partner-cta"
                      onClick={closeMenu}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      Become a Partner
                    </a>
                    <Link
                      to={REGISTER_SCHOOL_PATH}
                      className="scholar-mobile-nav-cta"
                      onClick={onRegisterClick}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      Register school
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
