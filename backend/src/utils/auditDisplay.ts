type JsonObject = Record<string, unknown>;

export function parseAuditDetails(details: unknown): JsonObject | null {
  if (details == null) return null;
  if (typeof details === 'object' && !Array.isArray(details)) return details as JsonObject;
  if (typeof details === 'string') {
    try {
      const p = JSON.parse(details) as unknown;
      if (typeof p === 'object' && p != null && !Array.isArray(p)) return p as JsonObject;
    } catch {
      return null;
    }
  }
  return null;
}

function pickRecordLabel(o: JsonObject): string {
  const keys = ['full_name', 'student_name', 'name', 'title', 'username', 'payee_name', 'class_name'];
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function describeDelta(prev: JsonObject, next: JsonObject): string {
  const keys = [
    'amount',
    'monthly_salary',
    'full_name',
    'class_name',
    'term',
    'gross_salary',
    'net_salary',
    'email',
    'phone',
  ];
  const parts: string[] = [];
  for (const k of keys) {
    if (prev[k] !== undefined && next[k] !== undefined && String(prev[k]) !== String(next[k])) {
      parts.push(`${k}: ${prev[k]} → ${next[k]}`);
    }
  }
  return parts.slice(0, 4).join('; ');
}

/** When DB `module` is empty (legacy rows), infer for display and filters. */
export function inferAuditModule(row: { module?: unknown; entity_type?: unknown; action?: unknown }): string {
  const m = row.module != null ? String(row.module).trim() : '';
  if (m) return m;
  const et = String(row.entity_type || '').toUpperCase();
  const ac = String(row.action || '').toUpperCase();
  if (/LOGIN|LOGOUT|PASSWORD|LOCK|AUTH|FAILED_LOGIN|SESSION/.test(ac)) return 'security';
  if (
    /PAYMENT|EXPENSE|INCOME|FEE|INVOICE|RECEIPT|SALARY|PAYROLL|LEDGER|ARREARS/.test(et) ||
    /SALARY|FEE|EXPENSE|PAYMENT|INVOICE|REFUND|PAYROLL/.test(ac)
  ) {
    return 'finance';
  }
  if (/STUDENT|TEACHER|CLASS|GRADE|ATTEND|SUBJECT/.test(et)) return 'academics';
  if (/SETTINGS|TENANT|SCHOOL/.test(et)) return 'settings';
  return 'general';
}

/**
 * When DB `summary` is empty, build a readable line (target of change, deltas, actor suffix).
 */
export function inferAuditSummary(row: Record<string, unknown>, actorUsername: string | null): string {
  const s = row.summary != null ? String(row.summary).trim() : '';
  if (s) return s;
  const action = String(row.action || '');
  const et = String(row.entity_type || '');
  const eid = row.entity_id != null ? String(row.entity_id) : '';
  const d = parseAuditDetails(row.details);
  const actor = actorUsername ? ` — by ${actorUsername}` : '';

  if (d && typeof d.studentName === 'string' && (action.includes('PAYMENT') || action.includes('FEE') || et === 'PAYMENT')) {
    const amt = d.amount != null ? ` — GHS ${d.amount}` : '';
    return `Fee payment — ${d.studentName}${amt}${actor}`.trim();
  }
  if (d && typeof d.payee_name === 'string' && (action.includes('SALARY') || et.includes('SALARY'))) {
    const amt = d.amount_paid != null ? ` — GHS ${d.amount_paid}` : d.paid != null ? ` — GHS ${d.paid}` : '';
    return `Salary payment — ${d.payee_name}${amt}${actor}`.trim();
  }
  if (d?.deleted_record && typeof d.deleted_record === 'object') {
    const dr = d.deleted_record as JsonObject;
    const label = pickRecordLabel(dr) || (eid ? `#${eid}` : '');
    return `Deleted ${et || 'record'}: ${label}${actor}`.trim();
  }
  if (d?.previous && d?.new && typeof d.previous === 'object' && typeof d.new === 'object') {
    const prev = d.previous as JsonObject;
    const next = d.new as JsonObject;
    const who = pickRecordLabel(next) || pickRecordLabel(prev) || (eid ? `#${eid}` : et);
    const delta = describeDelta(prev, next);
    return `Updated ${et || 'record'} — ${who}${delta ? ` (${delta})` : ''}${actor}`.trim();
  }
  if (action === 'LOGIN') {
    const u = (d?.username as string) || actorUsername || 'User';
    return `Successful login — ${u}`;
  }
  if (action === 'LOGOUT') {
    const u = (d?.username as string) || actorUsername || 'User';
    return `Logout — ${u}`;
  }
  if (action === 'FAILED_LOGIN') {
    const u = (d?.username as string) || 'unknown username';
    return `Failed login attempt — ${u}`;
  }
  if (action === 'LOGIN_BLOCKED') {
    return `Login blocked (account locked)${actor}`;
  }
  if (action === 'PASSWORD_CHANGE') {
    return `Password changed${actor}`;
  }
  if (action === 'CREATE' && et) {
    return `Created ${et}${eid ? ` #${eid}` : ''}${actor}`;
  }
  if (action === 'UPDATE' && et) {
    return `Updated ${et}${eid ? ` #${eid}` : ''}${actor}`;
  }
  if (action === 'DELETE' && et) {
    return `Deleted ${et}${eid ? ` #${eid}` : ''}${actor}`;
  }
  return `${action || 'EVENT'} · ${et || '—'}${eid ? ` #${eid}` : ''}${actor}`.trim();
}

/** API response: fill empty module/summary; normalize `details` to object when possible. */
export function enrichAuditLogRow(row: Record<string, unknown>): Record<string, unknown> {
  const username = row.username != null ? String(row.username) : null;
  const full =
    row.user_full_name != null && String(row.user_full_name).trim()
      ? String(row.user_full_name).trim()
      : username;
  const details = parseAuditDetails(row.details);
  const beforeValues = parseAuditDetails(row.before_values);
  const afterValues = parseAuditDetails(row.after_values);
  const base: Record<string, unknown> = { ...row, details: details ?? row.details };
  const moduleRaw = row.module != null ? String(row.module).trim() : '';
  const summaryRaw = row.summary != null ? String(row.summary).trim() : '';
  return {
    ...base,
    before_values: beforeValues ?? row.before_values,
    after_values: afterValues ?? row.after_values,
    module: moduleRaw || inferAuditModule(row),
    summary: summaryRaw || inferAuditSummary(base, full),
  };
}
