// Inactivity tracker: auto-logout after 3 hours for regular browser staff/admin sessions
const INACTIVITY_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
let inactivityTimer: number | null = null;
let lastActivityTimestamp = Date.now();

export function isPWAInstalled(): boolean {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as any).standalone === true;
  } catch (e) {
    return false;
  }
}

export function isParentPortalContext(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname || '';
    if (path.startsWith('/parent')) return true;
    const raw = localStorage.getItem('rosaGardensUser');
    if (!raw) return false;
    const user = JSON.parse(raw || '{}');
    return user?.role === 'parent';
  } catch (e) {
    return false;
  }
}

export function shouldTrackInactivity(): boolean {
  if (isPWAInstalled()) return false;
  if (isParentPortalContext()) return false;
  return true;
}

function handleSessionTimeout(): void {
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('lastActivityTimestamp');
  } catch (e) {
    // ignore
  }
  try {
    window.location.href = '/login?reason=session_timeout';
  } catch (e) {
    // ignore
  }
}

export function resetInactivityTimer(): void {
  if (!shouldTrackInactivity()) return;

  lastActivityTimestamp = Date.now();
  try {
    localStorage.setItem('lastActivityTimestamp', String(lastActivityTimestamp));
  } catch (e) {
    // ignore
  }

  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
  }
  inactivityTimer = window.setTimeout(() => {
    handleSessionTimeout();
  }, INACTIVITY_LIMIT_MS) as unknown as number;
}

export function initInactivityTracker(): void {
  if (!shouldTrackInactivity()) return;

  try {
    const last = localStorage.getItem('lastActivityTimestamp');
    if (last) {
      const elapsed = Date.now() - parseInt(last, 10);
      if (elapsed >= INACTIVITY_LIMIT_MS) {
        handleSessionTimeout();
        return;
      }
    }
  } catch (e) {
    // ignore
  }

  resetInactivityTimer();

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach((ev) => window.addEventListener(ev, resetInactivityTimer, { passive: true }));

  // Listen for storage events so other tabs reset timer
  window.addEventListener('storage', (e) => {
    if (e.key === 'lastActivityTimestamp' && e.newValue) {
      // another tab updated activity — reset local timer
      resetInactivityTimer();
    }
  });
}

export function stopInactivityTracker(): void {
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  try {
    localStorage.removeItem('lastActivityTimestamp');
  } catch (e) {
    // ignore
  }
}

export { INACTIVITY_LIMIT_MS };
