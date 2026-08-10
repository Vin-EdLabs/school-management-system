import type { MouseEvent } from 'react';

export const REGISTER_FORM_ID = 'register-form';
export const REGISTER_SCHOOL_PATH = `/register-school#${REGISTER_FORM_ID}`;
export const CONTACT_PATH = '/contact';
export const CONTACT_DEMO_PATH = '/contact?intent=demo';

export function scrollToRegisterForm(behavior?: ScrollBehavior) {
  const resolved =
    behavior ??
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  document.getElementById(REGISTER_FORM_ID)?.scrollIntoView({ behavior: resolved, block: 'start' });
}

export function scrollToHashSection(hash?: string) {
  const id = (hash ?? window.location.hash).replace(/^#/, '');
  if (!id) return;
  const resolved = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  document.getElementById(id)?.scrollIntoView({ behavior: resolved, block: 'start' });
}

/** On homepage, smooth-scroll to a section; otherwise navigate via router Link. */
export function handleLandingSectionNavClick(
  e: MouseEvent,
  pathname: string,
  hash: string,
  onNavigate?: () => void,
) {
  onNavigate?.();
  const onHome = pathname === '/' || pathname === '';
  if (!onHome) return;
  e.preventDefault();
  scrollToHashSection(hash);
}

/** Smooth-scroll to contact when already on the contact page with query params. */
export function handleContactNavClick(
  e: MouseEvent,
  pathname: string,
  options?: { demo?: boolean }
) {
  if (pathname === '/contact') return;
  if (pathname !== '/' && pathname !== '') return;

  e.preventDefault();
  const url = options?.demo ? CONTACT_DEMO_PATH : CONTACT_PATH;
  window.history.pushState(null, '', url);
  window.requestAnimationFrame(() => {
    if (options?.demo) {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    scrollToHashSection('contact');
  });
}

/** Smooth-scroll to register form when already on the register page. */
export function handleRegisterNavClick(
  e: MouseEvent,
  pathname: string,
  onNavigate?: () => void
) {
  onNavigate?.();
  if (pathname !== '/register-school') return;

  e.preventDefault();
  window.history.replaceState(null, '', REGISTER_SCHOOL_PATH);
  window.requestAnimationFrame(() => scrollToRegisterForm());
}
