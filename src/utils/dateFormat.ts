type DateInput = string | number | Date | null | undefined;

/** True when the value is a calendar date without a meaningful time component. */
function isDateOnlyValue(value: DateInput): boolean {
  if (!value) return false;
  if (value instanceof Date) {
    return value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0;
  }
  const raw = String(value).trim();
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d+)?Z?$/i.test(raw)
  );
}

function extractDateParts(value: DateInput): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  // PostgreSQL DATE often arrives as midnight UTC — keep the calendar day stable locally.
  const parts = extractDateParts(raw);
  if (parts && isDateOnlyValue(raw)) {
    return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasTime(value: DateInput): boolean {
  if (!value) return false;
  if (isDateOnlyValue(value)) return false;
  if (value instanceof Date || typeof value === 'number') return true;
  return /[T\s]\d{1,2}:\d{2}/.test(String(value));
}

export function formatDateForInput(value: DateInput): string {
  const parts = extractDateParts(value);
  if (parts) {
    return `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  }
  const date = toDate(value);
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(value: DateInput, fallback = '-'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
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
