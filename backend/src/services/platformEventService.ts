import { query } from '../db/connection.js';

export type PlatformEventType =
  | 'login'
  | 'student_action'
  | 'teacher_action'
  | 'staff_action'
  | 'grade_entry'
  | 'assessment'
  | 'report_card'
  | 'attendance_mark'
  | 'finance_txn'
  | 'class_action'
  | 'settings_action'
  | 'record_edit'
  | 'other';

export type PlatformEventInput = {
  tenantId: number | null;
  eventType: PlatformEventType | string;
  userRole?: string | null;
  userId?: number | null;
};

const FINANCE_ACTION_KEYS = [
  'PAYMENT',
  'RECEIPT',
  'INCOME',
  'EXPENSE',
  'INVOICE',
  'PAYROLL',
  'SALARY',
  'FINANCE',
  'FEE_',
  'LEDGER',
  'ARREARS',
  'FUND_TRANSFER',
  'BUDGET',
];

const RECORD_EDIT_ACTIONS = new Set([
  'CREATE',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'IMPORT',
  'RESTORE',
  'ARCHIVE',
  'ACTIVATE',
  'DEACTIVATE',
  'REACTIVATE',
  'PROMOTE',
  'ASSIGN',
  'TOGGLE',
]);

function entityMatches(entityType: string, ...tokens: string[]): boolean {
  const e = entityType.toLowerCase();
  return tokens.some((token) => e === token || e.includes(token));
}

function actionLooksLikeEdit(action: string): boolean {
  const a = action.toUpperCase();
  if (RECORD_EDIT_ACTIONS.has(a)) return true;
  return (
    a.endsWith('_CREATE') ||
    a.endsWith('_UPDATE') ||
    a.endsWith('_DELETE') ||
    a.endsWith('_EDIT') ||
    a.includes('_UPDATED') ||
    a.includes('_CREATED') ||
    a.includes('_DELETED')
  );
}

/** Map audit log rows to normalized platform event types for usage charts. */
export function mapAuditToPlatformEventType(
  action: string,
  module?: string | null,
  entityType?: string | null
): PlatformEventType {
  const a = action.toUpperCase();
  const m = (module || '').toLowerCase();
  const e = (entityType || '').toLowerCase();

  if (a === 'LOGIN' || a === 'SUPER_ADMIN_LOGIN') return 'login';
  if (a.includes('FAILED') && a.includes('LOGIN')) return 'other';
  if (a.includes('LOGOUT')) return 'other';

  if (
    entityMatches(e, 'student') ||
    m === 'students' ||
    m === 'academics' ||
    a.includes('STUDENT')
  ) {
    return 'student_action';
  }

  if (
    entityMatches(e, 'teacher') ||
    m === 'teachers' ||
    a.includes('TEACHER')
  ) {
    return 'teacher_action';
  }

  if (
    entityMatches(e, 'other_staff', 'staff_member') ||
    m === 'otherstaff' ||
    m === 'other_staff' ||
    a.includes('OTHER_STAFF')
  ) {
    return 'staff_action';
  }

  if (
    a === 'GRADE_ENTRY' ||
    a.includes('GRADE_ENTRY') ||
    e === 'student_grade'
  ) {
    return 'grade_entry';
  }

  if (
    a.includes('ASSESSMENT') ||
    e === 'grade_assignment' ||
    e === 'assessment'
  ) {
    return 'assessment';
  }

  if (
    a.includes('REPORT_CARD') ||
    a.includes('REPORT_RELEASE') ||
    e === 'report_card' ||
    e === 'term_report'
  ) {
    return 'report_card';
  }

  if (a.includes('ATTENDANCE') || e === 'attendance') return 'attendance_mark';

  if (
    FINANCE_ACTION_KEYS.some((key) => a.includes(key)) ||
    m === 'finance' ||
    m === 'payments' ||
    m === 'fees' ||
    m === 'payroll' ||
    m === 'income' ||
    m === 'expenses'
  ) {
    return 'finance_txn';
  }

  if (
    entityMatches(e, 'class') ||
    m === 'classes' ||
    a.includes('CLASS') ||
    a.includes('PROMOTE_CLASS') ||
    a.includes('GRADUATE_CLASS')
  ) {
    return 'class_action';
  }

  if (m === 'settings' || a.includes('SETTINGS') || a.includes('PASSWORD')) {
    return 'settings_action';
  }

  if (actionLooksLikeEdit(a)) return 'record_edit';

  return 'other';
}

/** Fire-and-forget insert — never blocks or throws to callers. */
export function recordPlatformEvent(input: PlatformEventInput): void {
  void (async () => {
    try {
      await query(
        `INSERT INTO platform_events (tenant_id, event_type, user_role, user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          input.tenantId ?? null,
          input.eventType,
          input.userRole ?? null,
          input.userId ?? null,
        ]
      );
    } catch (err) {
      console.error('[platformEventService] recordPlatformEvent failed:', (err as Error).message);
    }
  })();
}

/** Piggyback on audit log writes — fire-and-forget. */
export function recordPlatformEventFromAudit(row: {
  tenantId: number | null;
  userId: number | null;
  userRole?: string | null;
  action: string;
  module?: string | null;
  entityType?: string | null;
}): void {
  const eventType = mapAuditToPlatformEventType(
    row.action,
    row.module,
    row.entityType
  );
  recordPlatformEvent({
    tenantId: row.tenantId ?? null,
    eventType,
    userRole: row.userRole ?? null,
    userId: row.userId ?? null,
  });
}

export const PLATFORM_EVENT_LABELS: Record<string, string> = {
  login: 'Logins',
  student_action: 'Students',
  teacher_action: 'Teachers',
  staff_action: 'Staff',
  grade_entry: 'Grade Entries',
  assessment: 'Assessments',
  report_card: 'Report Cards',
  attendance_mark: 'Attendance',
  finance_txn: 'Finance',
  class_action: 'Classes',
  settings_action: 'Settings',
  record_edit: 'Record Edits',
  other: 'Other Actions',
};

export const GRADE_EVENT_TYPES = ['grade_entry', 'assessment', 'report_card'] as const;

export const TEACHER_STAFF_EVENT_TYPES = ['teacher_action', 'staff_action'] as const;

export function labelPlatformEventType(eventType: string): string {
  return PLATFORM_EVENT_LABELS[eventType] || eventType.replace(/_/g, ' ');
}
