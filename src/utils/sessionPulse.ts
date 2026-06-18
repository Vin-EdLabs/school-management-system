import { apiService } from '../services/api';

const STORAGE_KEY = 'rosaClientSessionId';
const PULSE_MS = 25_000;

let pulseTimer: number | null = null;

export function getClientSessionId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `s${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export async function sendSessionPulse(): Promise<void> {
  const token = localStorage.getItem('authToken');
  if (!token) return;
  await apiService.post(
    '/auth/session-pulse',
    { clientSessionId: getClientSessionId() },
    { skipTenant: true }
  );
}

export function startSessionPulse(): void {
  stopSessionPulse();
  void sendSessionPulse().catch(() => {
    // Non-fatal — presence is best-effort
  });
  pulseTimer = window.setInterval(() => {
    void sendSessionPulse().catch(() => {});
  }, PULSE_MS);
}

export function stopSessionPulse(): void {
  if (pulseTimer != null) {
    window.clearInterval(pulseTimer);
    pulseTimer = null;
  }
}

export async function endSessionPulse(): Promise<void> {
  stopSessionPulse();
  const token = localStorage.getItem('authToken');
  if (!token) return;
  try {
    await apiService.post(
      '/auth/session-end',
      { clientSessionId: getClientSessionId() },
      { skipTenant: true }
    );
  } catch {
    // ignore
  }
}
