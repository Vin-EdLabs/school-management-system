import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#parent-app', label: 'Mobile App' },
  { href: '#portals', label: 'Portals' },
  { href: '#about', label: 'About' },
] as const;

type LandingHeaderProps = {
  brandMark: React.ReactNode;
};

export default function LandingHeader({ brandMark }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleNavClick = () => {
    closeMenu();
  };

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

  return (
    <header className="scholar-landing-header fixed left-0 right-0 top-0 z-[100]">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5" aria-label="ScholarNerve home">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md shadow-emerald-950/10 ring-1 ring-[var(--sn-border)] sm:h-9 sm:w-9 sm:rounded-xl">
            {brandMark}
          </span>
          <span className="scholar-display truncate text-base font-bold text-[var(--ink)] sm:text-lg">
            ScholarNerve
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="scholar-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link to="/register-school" className="scholar-nav-cta">
            Register
          </Link>

          <div ref={menuRef} className="relative md:hidden">
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
                {NAV_LINKS.map((link, index) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="scholar-mobile-nav-link"
                    style={{ '--nav-delay': `${index * 40}ms` } as React.CSSProperties}
                    onClick={handleNavClick}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="scholar-mobile-nav-footer">
                <Link
                  to="/register-school"
                  className="scholar-mobile-nav-cta"
                  onClick={closeMenu}
                  tabIndex={menuOpen ? 0 : -1}
                >
                  Register school
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
