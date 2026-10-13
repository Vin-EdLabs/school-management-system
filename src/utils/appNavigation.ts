/** Apply in-app navigation from a notification/deep-link URL without reloading the page. */
import { BOARDING_MODULE_URLS, getSchoolPathPrefix, stripFeatureSubpaths } from './boardingModule';

export function applyAppNavigationFromUrl(rawUrl: string): { module: string | null; handled: boolean } {
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin) {
      return { module: null, handled: false };
    }

    const module = url.searchParams.get('module');
    const channel = url.searchParams.get('channel');

    if (channel) {
      try {
        sessionStorage.setItem('chat-open-channel', channel);
      } catch {
        /* ignore */
      }
    }

    if (module) {
      window.dispatchEvent(
        new CustomEvent('scholarnerve-app-nav', { detail: { module, channel, url: url.pathname + url.search } }),
      );
      return { module, handled: true };
    }

    return { module: null, handled: false };
  } catch {
    return { module: null, handled: false };
  }
}

export function readInitialModuleFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const module = params.get('module');
    const channel = params.get('channel');
    if (channel) {
      sessionStorage.setItem('chat-open-channel', channel);
    }
    if (module) {
      const next = new URL(window.location.href);
      next.searchParams.delete('module');
      next.searchParams.delete('channel');
      window.history.replaceState({}, '', next.pathname + next.search + next.hash);
    }
    return module;
  } catch {
    return null;
  }
}

const TRANSPORT_MODULE_URLS: Record<string, string> = {
  'transport-overview': '/transport',
  'transport-map': '/transport/map',
  'transport-routes': '/transport/routes',
  'transport-vehicles': '/transport/vehicles',
  'transport-drivers': '/transport/drivers',
  'transport-students': '/transport/students',
  'transport-fees-owing': '/transport/fees-owing',
};

const FINANCE_MODULE_URLS: Record<string, string> = {
  transactions: '/finance/transactions',
  'daily-fees': '/finance/daily-fees',
};

/** Keep the browser URL aligned with the active in-app module (no full reload). */
export function syncAppUrlForModule(moduleId: string): void {
  const prefix = getSchoolPathPrefix();
  const deepLink =
    BOARDING_MODULE_URLS[moduleId] ||
    TRANSPORT_MODULE_URLS[moduleId] ||
    FINANCE_MODULE_URLS[moduleId];

  if (deepLink) {
    window.history.pushState({}, '', `${prefix}${deepLink}`);
    return;
  }

  const next = stripFeatureSubpaths(window.location.pathname);
  if (next !== window.location.pathname) {
    window.history.pushState({}, '', next);
  }
}
