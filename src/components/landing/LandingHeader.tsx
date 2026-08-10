import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScholarNerveMainUrl, getPartnersPortalLoginUrl, isPartnersHost } from '@/utils/partnersHost';
import { REGISTER_SCHOOL_PATH, handleLandingSectionNavClick, handleRegisterNavClick } from '@/utils/landingScroll';

type HomeNavItem = {
  label: string;
  path: string;
  hash?: string;
};

const HOME_NAV: HomeNavItem[] = [
  { label: 'Features', path: '/features', hash: 'features' },
  { label: 'Mobile App', path: '/#parent-app', hash: 'parent-app' },
  { label: 'Pricing', path: '/pricing', hash: 'pricing' },
  { label: 'About', path: '/about', hash: 'about' },
  { label: 'Contact', path: '/contact', hash: 'contact' },
  { label: 'School Website', path: '/#school-website', hash: 'school-website' },
];

const HOME_NAV_PRIMARY: HomeNavItem[] = [
  { label: 'Features', path: '/features', hash: 'features' },
  { label: 'Pricing', path: '/pricing', hash: 'pricing' },
  { label: 'About', path: '/about', hash: 'about' },
  { label: 'Contact', path: '/contact', hash: 'contact' },
];

const HOME_NAV_MORE: HomeNavItem[] = [
  { label: 'Mobile App', path: '/#parent-app', hash: 'parent-app' },
  { label: 'School Website', path: '/#school-website', hash: 'school-website' },
];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!moreOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
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
  }, [moreOpen]);

  const scrollToApply = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onRegisterClick = (e: React.MouseEvent) => {
    handleRegisterNavClick(e, location.pathname, closeMenu);
  };

  const isNavActive = (path: string) => {
    if (path.startsWith('/#')) return false;
    return location.pathname === path;
  };

  const renderHomeNavLink = (item: HomeNavItem, className: string, tabIndex?: number) => {
    const active = isNavActive(item.path);
    const onClick = (e: React.MouseEvent) => {
      if (item.hash) {
        handleLandingSectionNavClick(e, location.pathname, item.hash, closeMenu);
      } else {
        closeMenu();
      }
    };

    if (item.path.startsWith('/#')) {
      return (
        <Link
          key={item.label}
          to={item.path}
          className={cn(className, active && 'text-[var(--brand-dark)] font-semibold')}
          onClick={onClick}
          tabIndex={tabIndex}
        >
          {item.label}
        </Link>
      );
    }

    return (
      <Link
        key={item.label}
        to={item.path}
        className={cn(className, active && 'text-[var(--brand-dark)] font-semibold')}
        onClick={onClick}
        tabIndex={tabIndex}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="scholar-landing-header fixed left-0 right-0 top-0 z-[100]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:gap-4">
        <Link to={brandHref} className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5" aria-label={isPartners ? 'ScholarNerve Partners home' : 'ScholarNerve home'}>
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

        <nav className="scholar-desktop-nav hidden min-w-0 flex-1 items-center justify-center lg:flex" aria-label="Main">
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
          {isPartners
            ? navLinks.map((link) => (
                <a key={link.href} href={link.href} className="scholar-nav-link">
                  {link.label}
                </a>
              ))
            : (
              <>
                {HOME_NAV_PRIMARY.map((item) => renderHomeNavLink(item, 'scholar-nav-link'))}
                <div ref={moreRef} className="relative">
                  <button
                    type="button"
                    className={cn(
                      'scholar-nav-link inline-flex items-center gap-1',
                      moreOpen && 'bg-[var(--brand-light)] text-[var(--brand-dark)]',
                    )}
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                    onClick={() => setMoreOpen((open) => !open)}
                  >
                    More
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} />
                  </button>
                  {moreOpen ? (
                    <div className="scholar-nav-more-menu" role="menu">
                      {HOME_NAV_MORE.map((item) => (
                        <div key={item.label} role="none">
                          {item.path.startsWith('/#') ? (
                            <Link
                              to={item.path}
                              role="menuitem"
                              className="scholar-nav-more-item"
                              onClick={(e) => {
                                handleLandingSectionNavClick(e, location.pathname, item.hash!, closeMenu);
                                setMoreOpen(false);
                              }}
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <Link
                              to={item.path}
                              role="menuitem"
                              className="scholar-nav-more-item"
                              onClick={() => setMoreOpen(false)}
                            >
                              {item.label}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link
                  to="/partners"
                  className={cn(
                    'scholar-nav-link font-semibold text-[var(--brand-dark)]',
                    location.pathname === '/partners' && 'underline underline-offset-4',
                  )}
                  onClick={closeMenu}
                >
                  Partners
                </Link>
              </>
            )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-2.5">
          {!isPartners && (
            <a
              href={partnerLoginUrl}
              className="scholar-nav-link-secondary scholar-header-desktop-only"
            >
              Partner Login
            </a>
          )}
          {isPartners && (
            <a href={partnerLoginUrl} className="snp-partner-login-nav-btn scholar-header-desktop-only">
              Partner Login
            </a>
          )}

          {!isPartners && (
            <Link
              to="/partners"
              className="scholar-nav-partner-cta scholar-header-desktop-only"
            >
              Become a Partner
            </Link>
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
                {isPartners
                  ? navLinks.map((link, index) => (
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
                    ))
                  : HOME_NAV.map((item, index) =>
                      renderHomeNavLink(
                        item,
                        'scholar-mobile-nav-link',
                        menuOpen ? 0 : -1,
                      )
                    )}
                {!isPartners && (
                  <Link
                    to="/partners"
                    className={cn(
                      'scholar-mobile-nav-link font-semibold text-[var(--brand-dark)]',
                      location.pathname === '/partners' && 'underline underline-offset-4',
                    )}
                    style={{ '--nav-delay': `${navLinks.length * 40}ms` } as React.CSSProperties}
                    onClick={closeMenu}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    Partners
                  </Link>
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
                {!isPartners && (
                  <a
                    href={partnerLoginUrl}
                    className="scholar-mobile-nav-link font-semibold text-[var(--brand-dark)]"
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
                    <Link
                      to="/partners"
                      className="scholar-mobile-nav-partner-cta"
                      onClick={closeMenu}
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      Become a Partner
                    </Link>
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
