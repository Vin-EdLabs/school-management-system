/**
 * Maps fetch / auth failures to user-facing copy (network vs credentials vs server).
 */
export function getFriendlyLoginMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Something went wrong. Please try again.';

  const m = raw.trim();
  const lower = m.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('fetch') && lower.includes('aborted')
  ) {
    return 'We could not reach the server. Check your internet connection, confirm the site address, and try again.';
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request took too long. Check your connection and try again.';
  }

  if (lower.includes('invalid response') || lower.includes('unexpected token') || lower.includes('json')) {
    return 'The server returned an unexpected response. If this continues, contact support.';
  }

  if (
    m.length > 0 &&
    (lower.includes('invalid') ||
      lower.includes('incorrect') ||
      lower.includes('wrong') ||
      lower.includes('password') ||
      lower.includes('credential') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('401') ||
      lower.includes('403'))
  ) {
    return m.length > 220 ? `${m.slice(0, 217)}…` : m;
  }

  return m.length > 280 ? `${m.slice(0, 277)}…` : m || 'Sign-in failed. Please try again.';
}

export function getFriendlyLoginTitle(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  const lower = msg.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Connection problem';
  }
  if (lower.includes('timeout')) {
    return 'Request timed out';
  }
  return 'Sign-in failed';
}
