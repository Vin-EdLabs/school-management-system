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
  const keys = [
    'full_name',
    'fullName',
    'student_name',
    'studentName',
    'name',
    'title',
    'username',
    'payee_name',
    'class_name',
    'className',
    'staff_id',
    'staffId',
    'admission_number',
    'admissionNumber',
  ];
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  const first = String(o.first_name || o.firstName || '').trim();
  const last = String(o.last_name || o.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  return '';
}

function studentLabelFromObject(o: JsonObject): string {
  if (typeof o.studentName === 'string' && o.studentName.trim()) {
    const cls = o.className || o.class_name;
    return cls ? `${o.studentName.trim()} · ${cls}` : o.studentName.trim();
  }
  const name = pickRecordLabel(o);
  if (!name) return '';
  const cls = o.class_name || o.className;
  const adm = o.admission_number || o.admissionNumber;
  let label = name;
  if (cls && String(cls).trim()) label += ` · ${String(cls).trim()}`;
  if (adm && String(adm).trim()) label += ` (${String(adm).trim()})`;
  return label;
}

function humanEntityType(entityType: string): string {
  const et = entityType.trim().toUpperCase();
  const map: Record<string, string> = {
    STUDENT: 'student',
    TEACHER: 'teacher',
    CLASS: 'class',
    USER: 'user',
    PAYMENT: 'payment',
    INCOME: 'income',
    EXPENSE: 'expense',
    FEE_STRUCTURE: 'fee structure',
    SALARY_PAYMENT: 'salary payment',
    PAYROLL_OTHER_STAFF: 'staff member',
    PAYROLL_RUN: 'payroll run',
    PAYROLL_SETTINGS: 'payroll settings',
    PARENT_PORTAL_ACCOUNT: 'parent account',
  };
  return map[et] || et.toLowerCase().replace(/_/g, ' ');
}

/** Resolve a human-readable target label (name, class, etc.) — never prefer numeric IDs. */
export function resolveEntityLabelFromRow(row: Record<string, unknown>): string {
  const fromJoin = row.entity_label != null ? String(row.entity_label).trim() : '';
  if (fromJoin) return fromJoin;

  const sources = [
    parseAuditDetails(row.after_values),
    parseAuditDetails(row.before_values),
    parseAuditDetails(row.details),
  ];

  for (const src of sources) {
    if (!src) continue;
    const student = studentLabelFromObject(src);
    if (student) return student;
    const label = pickRecordLabel(src);
    if (label) return label;
    if (src.deleted_record && typeof src.deleted_record === 'object') {
      const dr = src.deleted_record as JsonObject;
      const deleted = studentLabelFromObject(dr) || pickRecordLabel(dr);
      if (deleted) return deleted;
    }
    if (src.previous && typeof src.previous === 'object') {
      const prev = src.previous as JsonObject;
      const pl = studentLabelFromObject(prev) || pickRecordLabel(prev);
      if (pl) return pl;
    }
    if (src.new && typeof src.new === 'object') {
      const next = src.new as JsonObject;
      const nl = studentLabelFromObject(next) || pickRecordLabel(next);
      if (nl) return nl;
    }
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

function formatEntityTarget(row: Record<string, unknown>, entityType: string): string {
  const label = resolveEntityLabelFromRow(row);
  if (label) return label;
  if (entityType) return humanEntityType(entityType);
  return 'record';
}

/**
 * When DB `summary` is empty, build a readable line (target of change, deltas, actor suffix).
 */
export function inferAuditSummary(row: Record<string, unknown>, actorUsername: string | null): string {
  const s = row.summary != null ? String(row.summary).trim() : '';
  if (s) return s;
  const action = String(row.action || '');
  const et = String(row.entity_type || '');
  const d = parseAuditDetails(row.details);
  const actor = actorUsername ? ` — by ${actorUsername}` : '';
  const target = formatEntityTarget(row, et);

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
    const label = studentLabelFromObject(dr) || pickRecordLabel(dr) || target;
    return `Deleted ${humanEntityType(et) || 'record'}: ${label}${actor}`.trim();
  }
  if (d?.previous && d?.new && typeof d.previous === 'object' && typeof d.new === 'object') {
    const prev = d.previous as JsonObject;
    const next = d.new as JsonObject;
    const who =
      studentLabelFromObject(next) ||
      studentLabelFromObject(prev) ||
      pickRecordLabel(next) ||
      pickRecordLabel(prev) ||
      target;
    const delta = describeDelta(prev, next);
    return `Updated ${humanEntityType(et) || 'record'} — ${who}${delta ? ` (${delta})` : ''}${actor}`.trim();
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
    return `Created ${humanEntityType(et)} — ${target}${actor}`.trim();
  }
  if (action === 'UPDATE' && et) {
    return `Updated ${humanEntityType(et)} — ${target}${actor}`.trim();
  }
  if (action === 'DELETE' && et) {
    return `Deleted ${humanEntityType(et)} — ${target}${actor}`.trim();
  }
  if (/^STUDENT_/.test(action) && et === 'STUDENT') {
    const verb = action.replace(/_/g, ' ').toLowerCase();
    return `${verb.charAt(0).toUpperCase() + verb.slice(1)} — ${target}${actor}`.trim();
  }
  if (/^TEACHER_/.test(action) && et === 'TEACHER') {
    const verb = action.replace(/_/g, ' ').toLowerCase();
    return `${verb.charAt(0).toUpperCase() + verb.slice(1)} — ${target}${actor}`.trim();
  }
  if (action === 'PROMOTE' && et === 'STUDENT') {
    return `Promoted student — ${target}${actor}`.trim();
  }
  if (action === 'DEACTIVATE' || action === 'REACTIVATE') {
    return `${action.charAt(0) + action.slice(1).toLowerCase()} — ${target}${actor}`.trim();
  }
  return `${action || 'EVENT'} · ${target}${actor}`.trim();
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
  const entityLabel = resolveEntityLabelFromRow(row);
  const base: Record<string, unknown> = {
    ...row,
    details: details ?? row.details,
    entity_label: entityLabel || row.entity_label || null,
  };
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

/** SQL joins + label column for audit list queries. */
export const AUDIT_ENTITY_JOINS = `
  LEFT JOIN students st_ent ON UPPER(COALESCE(al.entity_type, '')) = 'STUDENT'
    AND st_ent.id = al.entity_id AND st_ent.tenant_id = al.tenant_id
  LEFT JOIN classes cl_st ON cl_st.id = st_ent.class_assigned_id AND cl_st.tenant_id = al.tenant_id
  LEFT JOIN teachers t_ent ON UPPER(COALESCE(al.entity_type, '')) = 'TEACHER'
    AND t_ent.id = al.entity_id AND t_ent.tenant_id = al.tenant_id
  LEFT JOIN classes cl_ent ON UPPER(COALESCE(al.entity_type, '')) = 'CLASS'
    AND cl_ent.id = al.entity_id AND cl_ent.tenant_id = al.tenant_id
  LEFT JOIN users u_ent ON UPPER(COALESCE(al.entity_type, '')) = 'USER'
    AND u_ent.id = al.entity_id AND (u_ent.tenant_id = al.tenant_id OR al.tenant_id IS NULL)
  LEFT JOIN payments p_ent ON UPPER(COALESCE(al.entity_type, '')) = 'PAYMENT'
    AND p_ent.id = al.entity_id AND p_ent.tenant_id = al.tenant_id
  LEFT JOIN students st_pay ON st_pay.id = p_ent.student_id AND st_pay.tenant_id = al.tenant_id
  LEFT JOIN classes cl_pay ON cl_pay.id = st_pay.class_assigned_id AND cl_pay.tenant_id = al.tenant_id
  LEFT JOIN payroll_other_staff pos_ent ON UPPER(COALESCE(al.entity_type, '')) IN ('PAYROLL_OTHER_STAFF', 'STAFF')
    AND pos_ent.id = al.entity_id AND pos_ent.tenant_id = al.tenant_id
  LEFT JOIN fee_structures fs_ent ON UPPER(COALESCE(al.entity_type, '')) = 'FEE_STRUCTURE'
    AND fs_ent.id = al.entity_id AND (fs_ent.tenant_id = al.tenant_id OR fs_ent.tenant_id IS NULL)
  LEFT JOIN classes cl_fs ON cl_fs.id = fs_ent.class_id AND cl_fs.tenant_id = al.tenant_id
`;

export const AUDIT_ENTITY_LABEL_SQL = `
  NULLIF(TRIM(
    CASE
      WHEN st_ent.id IS NOT NULL THEN
        TRIM(BOTH FROM CONCAT(
          TRIM(COALESCE(st_ent.first_name, '') || ' ' || COALESCE(st_ent.last_name, '')),
          CASE WHEN cl_st.class_name IS NOT NULL AND TRIM(cl_st.class_name) <> ''
            THEN ' · ' || TRIM(cl_st.class_name) ELSE '' END,
          CASE WHEN st_ent.admission_number IS NOT NULL AND TRIM(st_ent.admission_number) <> ''
            THEN ' (' || TRIM(st_ent.admission_number) || ')' ELSE '' END
        ))
      WHEN t_ent.id IS NOT NULL THEN
        TRIM(BOTH FROM CONCAT(
          TRIM(COALESCE(t_ent.full_name, '')),
          CASE WHEN t_ent.staff_id IS NOT NULL AND TRIM(t_ent.staff_id) <> ''
            THEN ' · ' || TRIM(t_ent.staff_id) ELSE '' END
        ))
      WHEN cl_ent.id IS NOT NULL THEN NULLIF(TRIM(cl_ent.class_name), '')
      WHEN u_ent.id IS NOT NULL THEN COALESCE(NULLIF(TRIM(u_ent.full_name), ''), u_ent.username)
      WHEN p_ent.id IS NOT NULL AND st_pay.id IS NOT NULL THEN
        TRIM(BOTH FROM CONCAT(
          TRIM(COALESCE(st_pay.first_name, '') || ' ' || COALESCE(st_pay.last_name, '')),
          CASE WHEN cl_pay.class_name IS NOT NULL AND TRIM(cl_pay.class_name) <> ''
            THEN ' · ' || TRIM(cl_pay.class_name) ELSE '' END,
          CASE WHEN COALESCE(p_ent.amount_paid, p_ent.amount) IS NOT NULL
            THEN ' · GHS ' || ROUND(COALESCE(p_ent.amount_paid, p_ent.amount)::numeric, 2)::text
            ELSE '' END
        ))
      WHEN pos_ent.id IS NOT NULL THEN
        TRIM(BOTH FROM CONCAT(
          TRIM(COALESCE(pos_ent.full_name, '')),
          CASE WHEN pos_ent.role IS NOT NULL AND TRIM(pos_ent.role) <> ''
            THEN ' · ' || TRIM(pos_ent.role) ELSE '' END
        ))
      WHEN fs_ent.id IS NOT NULL THEN
        TRIM(BOTH FROM CONCAT(
          CASE WHEN cl_fs.class_name IS NOT NULL AND TRIM(cl_fs.class_name) <> ''
            THEN TRIM(cl_fs.class_name) || ' · ' ELSE '' END,
          'Fee structure'
        ))
      ELSE ''
    END
  ), '') AS entity_label
`;
