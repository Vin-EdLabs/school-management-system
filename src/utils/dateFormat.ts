type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  // Treat date-only values as local dates so display does not shift by timezone.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasTime(value: DateInput): boolean {
  if (!value) return false;
  if (value instanceof Date || typeof value === 'number') return true;
  return /[T\s]\d{1,2}:\d{2}/.test(String(value));
}

export function formatDisplayDate(value: DateInput, fallback = '-'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDisplayTime(value: DateInput, fallback = '-'): string {
  if (!hasTime(value)) return fallback;
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDisplayDateTime(value: DateInput, fallback = '-'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDisplayDate(date, fallback)} ${formatDisplayTime(date, fallback)}`;
}
