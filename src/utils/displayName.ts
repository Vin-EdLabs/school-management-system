const HONORIFICS = new Set([
  'mr',
  'mr.',
  'mrs',
  'mrs.',
  'ms',
  'ms.',
  'miss',
  'dr',
  'dr.',
  'prof',
  'prof.',
  'rev',
  'rev.',
]);

/** Mobile greeting: honorific + first name (e.g. "Mr Vincent"), or first name only. */
export function getShortGreetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length >= 2 && HONORIFICS.has(parts[0].toLowerCase())) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}
