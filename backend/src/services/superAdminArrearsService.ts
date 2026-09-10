import { query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';

/**
 * Super-admin tool: clear stale "arrears" entries (debt carried forward from a
 * previous term) WITHOUT touching anything else — fee structures, payments,
 * invoices, and the terms themselves are never read or written here. This is
 * deliberately narrower than deleteTermCompletely: it only ever deletes
 * student_ledger rows where entry_type = 'arrears'.
 */

export type ArrearsRow = {
  ledgerRowId: number;
  studentId: number;
  studentName: string;
  admissionNumber: string | null;
  className: string | null;
  amount: number;
  description: string;
  createdAt: string;
  termId: number;
  termName: string;
  academicYear: string;
  carriedFromTermId: number | null;
  carriedFromTermName: string | null;
  carriedFromAcademicYear: string | null;
};

export type ArrearsPreview = {
  tenantId: number;
  studentId: number | null;
  totals: {
    rowCount: number;
    studentsAffected: number;
    totalAmount: number;
  };
  rows: ArrearsRow[];
};

async function loadArrearsRows(tenantId: number, studentId: number | null): Promise<ArrearsRow[]> {
  const res = await query(
    `SELECT sl.id AS ledger_row_id, sl.student_id,
            s.first_name, s.last_name, s.admission_number,
            c.class_name,
            sl.debit AS amount, sl.description, sl.created_at,
            sl.term_id, t.name AS term_name, COALESCE(ay.label, ay.name) AS academic_year,
            (sl.metadata->>'carried_from_term_id')::int AS carried_from_term_id,
            st.name AS carried_from_term_name, COALESCE(say.label, say.name) AS carried_from_academic_year
     FROM student_ledger sl
     JOIN students s ON s.id = sl.student_id AND s.tenant_id = sl.tenant_id
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = sl.tenant_id
     JOIN terms t ON t.id = sl.term_id AND t.tenant_id = sl.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     LEFT JOIN terms st ON st.id = (sl.metadata->>'carried_from_term_id')::int AND st.tenant_id = sl.tenant_id
     LEFT JOIN academic_years say ON say.id = st.academic_year_id
     WHERE sl.tenant_id = $1
       AND sl.entry_type = 'arrears'
       AND ($2::int IS NULL OR sl.student_id = $2)
     ORDER BY s.last_name ASC NULLS LAST, s.first_name ASC NULLS LAST, sl.created_at ASC`,
    [tenantId, studentId]
  );

  return res.rows.map((row) => ({
    ledgerRowId: Number(row.ledger_row_id),
    studentId: Number(row.student_id),
    studentName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown student',
    admissionNumber: row.admission_number || null,
    className: row.class_name || null,
    amount: parseFloat(String(row.amount)) || 0,
    description: String(row.description || ''),
    createdAt: row.created_at ? String(row.created_at) : '',
    termId: Number(row.term_id),
    termName: String(row.term_name || ''),
    academicYear: String(row.academic_year || ''),
    carriedFromTermId: row.carried_from_term_id != null ? Number(row.carried_from_term_id) : null,
    carriedFromTermName: row.carried_from_term_name || null,
    carriedFromAcademicYear: row.carried_from_academic_year || null,
  }));
}

export async function getArrearsPreview(tenantId: number, studentId: number | null): Promise<ArrearsPreview> {
  const rows = await loadArrearsRows(tenantId, studentId);
  const studentIds = new Set(rows.map((r) => r.studentId));
  const totalAmount = Math.round(rows.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;

  return {
    tenantId,
    studentId,
    totals: {
      rowCount: rows.length,
      studentsAffected: studentIds.size,
      totalAmount,
    },
    rows,
  };
}

export type ClearArrearsResult = {
  success: boolean;
  rowsDeleted: number;
  studentsAffected: number;
  totalAmount: number;
};

export async function clearArrears(input: {
  tenantId: number;
  studentId: number | null;
  actorUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ClearArrearsResult> {
  const preview = await getArrearsPreview(input.tenantId, input.studentId);
  if (preview.rows.length === 0) {
    return { success: true, rowsDeleted: 0, studentsAffected: 0, totalAmount: 0 };
  }

  const ledgerRowIds = preview.rows.map((r) => r.ledgerRowId);
  const res = await query(
    `DELETE FROM student_ledger
     WHERE tenant_id = $1 AND id = ANY($2::int[]) AND entry_type = 'arrears'
     RETURNING id`,
    [input.tenantId, ledgerRowIds]
  );
  const rowsDeleted = res.rowCount ?? 0;

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    userRole: 'super-admin',
    action: 'ARREARS_CLEARED',
    entityType: 'STUDENT_LEDGER',
    entityId: input.studentId ?? 0,
    module: 'super-admin',
    summary: input.studentId
      ? `Super admin cleared ${rowsDeleted} arrears entry(s) for student #${input.studentId} — ${preview.totals.totalAmount ? `GHS ${preview.totals.totalAmount.toFixed(2)}` : ''}`
      : `Super admin cleared ${rowsDeleted} arrears entry(s) school-wide — GHS ${preview.totals.totalAmount.toFixed(2)}`,
    details: {
      studentId: input.studentId,
      rowsDeleted,
      studentsAffected: preview.totals.studentsAffected,
      totalAmount: preview.totals.totalAmount,
      clearedRows: preview.rows.map((r) => ({
        ledgerRowId: r.ledgerRowId,
        studentId: r.studentId,
        studentName: r.studentName,
        amount: r.amount,
        termId: r.termId,
        termName: r.termName,
        carriedFromTermId: r.carriedFromTermId,
        carriedFromTermName: r.carriedFromTermName,
      })),
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    success: true,
    rowsDeleted,
    studentsAffected: preview.totals.studentsAffected,
    totalAmount: preview.totals.totalAmount,
  };
}
