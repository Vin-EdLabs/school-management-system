import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LandingBrandMark from './LandingBrandMark';

type LegalDocKey = 'privacy' | 'terms';

const EXPLORE = [
  { href: '/#features', label: 'Features' },
  { href: '/#parent-app', label: 'Mobile App' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
  { href: '/#school-website', label: 'School Website' },
  { href: '/#partners', label: 'Partners' },
] as const;

export default function LandingFooter() {
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null);

  return (
    <>
      <footer className="bg-[var(--ink)] px-4 pb-8 pt-14 text-white sm:px-5">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid gap-10 border-t border-white/[0.08] pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-white ring-1 ring-white/20">
                  <LandingBrandMark className="h-full w-full" />
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
                {EXPLORE.map((item) =>
                  'to' in item ? (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="block text-sm text-white/50 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      key={item.href}
                      href={item.href}
                      className="block text-sm text-white/50 transition-colors hover:text-white"
                    >
                      {item.label}
                    </a>
                  )
                )}
              </div>
            </div>

            <div>
              <p className="mb-4 text-sm font-bold text-white">Legal</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setActiveLegalDoc('privacy')}
                  className="block text-left text-sm text-white/50 transition-colors hover:text-white"
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLegalDoc('terms')}
                  className="block text-left text-sm text-white/50 transition-colors hover:text-white"
                >
                  Terms of Service
                </button>
              </div>
              <p className="mb-4 mt-8 text-sm font-bold text-white">Support</p>
              <div className="space-y-3">
                <a href="/#contact" className="block text-sm text-white/50 transition-colors hover:text-white">
                  Contact Us
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-sm text-white/50 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} ScholarNerve. All rights reserved.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <a href="mailto:scholarnerve@gmail.com" className="hover:text-white">
                scholarnerve@gmail.com
              </a>
              <a
                href="https://wa.me/233531932399"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                WhatsApp: 053 193 2399
              </a>
              <a href="tel:+233506741322" className="hover:text-white">
                Call: 050 674 1322
              </a>
            </div>
          </div>
        </div>
      </footer>

      {activeLegalDoc && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/70 px-4 py-6 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveLegalDoc(null)}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-white/20 bg-white p-6 text-[var(--ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="scholar-display text-2xl font-bold">
              {activeLegalDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Full legal documents are available on the ScholarNerve home page. Contact
              scholarnerve@gmail.com for the complete policy text.
            </p>
            <button type="button" className="scholar-btn-primary mt-6" onClick={() => setActiveLegalDoc(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
