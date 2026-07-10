import { sqlBeneficiaryAdjustedAmount } from './beneficiaryFee.js';

/** Normalized class name for SQL — collapse whitespace, lowercase. */
export function sqlNormalizeClassName(column: string): string {
  return `LOWER(REGEXP_REPLACE(TRIM(COALESCE(${column}, '')), '\\s+', ' ', 'g'))`;
}

export const SQL_NORMALIZE_CLASS_NAME = sqlNormalizeClassName;

/** Match fee structure class to the student's assigned class (by id or normalized name). */
export const SQL_FEE_STRUCTURE_CLASS_MATCH = `
  (
    (s.class_assigned_id IS NOT NULL AND fs.class_id = s.class_assigned_id)
    OR (
      s.class_assigned_id IS NOT NULL
      AND ${sqlNormalizeClassName("COALESCE(c_student.class_name, '')")} <>
          ${sqlNormalizeClassName("''")}
      AND ${sqlNormalizeClassName("COALESCE(c_fs.class_name, '')")} =
          ${sqlNormalizeClassName("COALESCE(c_student.class_name, '')")}
    )
  )
`;

/**
 * Join fee structures to students for the active ledger term.
 * `c_fs` must be joined before SQL_FEE_STRUCTURE_CLASS_MATCH is applied (WHERE, not fs ON).
 */
export const SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM = `
  INNER JOIN ledger_fee_structures fs ON fs.tenant_id = s.tenant_id
    AND fs.term_id = t.id
    AND fs.academic_year_id = t.academic_year_id
  INNER JOIN classes c_fs ON c_fs.id = fs.class_id AND c_fs.tenant_id = fs.tenant_id
`;

/** Active fee_structure_items sum, falling back to ledger_fee_structures.total (includes GHS 0 tuition). */
export const SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL = `COALESCE(
  (SELECT SUM(fsi.amount)::numeric
   FROM fee_structure_items fsi
   WHERE fsi.tenant_id = fs.tenant_id
     AND fsi.fee_structure_id = fs.id
     AND fsi.is_active = true),
  fs.total,
  0::numeric
)`;

/** Net term_fee debit for student \`s\` joined to fee structure alias \`fs\`. */
export const SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE = sqlBeneficiaryAdjustedAmount(
  `(${SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL})`
);

/**
 * Ledger totals per student with fee-structure fallback when ledger term_fee is missing/zero.
 * Params: $1 tenant_id, $2 ledger term_id (academic_terms.id / terms.id).
 */
export const SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE = `
  prev_closed_term AS (
    SELECT pt.id AS prev_term_id
    FROM terms pt
    WHERE pt.tenant_id = $1
      AND pt.status = 'closed'
      AND pt.id <> $2::integer
      AND (
        (
          EXISTS (
            SELECT 1 FROM terms cur
            WHERE cur.id = $2::integer AND cur.tenant_id = $1 AND cur.start_date IS NOT NULL
          )
          AND pt.end_date IS NOT NULL
          AND pt.end_date < (SELECT start_date FROM terms WHERE id = $2::integer AND tenant_id = $1)
        )
        OR NOT EXISTS (
          SELECT 1 FROM terms cur
          WHERE cur.id = $2::integer AND cur.tenant_id = $1 AND cur.start_date IS NOT NULL
        )
      )
    ORDER BY
      CASE WHEN pt.end_date IS NOT NULL THEN 0 ELSE 1 END,
      pt.end_date DESC NULLS LAST,
      pt.closed_at DESC NULLS LAST,
      pt.id DESC
    LIMIT 1
  ),
  snapshot_arrears AS (
    SELECT tcb.student_id, tcb.carried_balance::numeric AS arrears_amt
    FROM term_closing_balances tcb
    INNER JOIN prev_closed_term pct ON pct.prev_term_id = tcb.term_id
    WHERE tcb.tenant_id = $1
  ),
  raw_ledger_totals AS (
    SELECT
      sl.student_id,
      COALESCE(SUM(CASE WHEN sl.entry_type = 'term_fee' THEN sl.debit ELSE 0 END), 0)::numeric AS term_fee,
      COALESCE(SUM(CASE WHEN sl.entry_type = 'arrears' THEN sl.debit ELSE 0 END), 0)::numeric AS arrears_ledger,
      COALESCE(SUM(CASE WHEN sl.entry_type = 'payment' THEN sl.credit ELSE 0 END), 0)::numeric AS paid_amt
    FROM student_ledger sl
    WHERE sl.tenant_id = $1 AND sl.term_id = $2::integer
    GROUP BY sl.student_id
  ),
  structure_term_fees AS (
    SELECT DISTINCT ON (s.id)
      s.id AS student_id,
      true AS has_fee_structure,
      (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE})::numeric AS structure_term_fee
    FROM students s
    LEFT JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
    INNER JOIN terms t ON t.id = $2::integer AND t.tenant_id = s.tenant_id
    ${SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM}
    WHERE s.tenant_id = $1
      AND (${SQL_FEE_STRUCTURE_CLASS_MATCH})
    ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
  ),
  student_ledger_totals AS (
    SELECT
      s.id AS student_id,
      CASE
        WHEN COALESCE(rlt.term_fee, 0) > 0 THEN rlt.term_fee
        ELSE COALESCE(stf.structure_term_fee, 0)
      END::numeric AS term_fee,
      CASE
        WHEN EXISTS (SELECT 1 FROM prev_closed_term)
          THEN COALESCE(sa.arrears_amt, 0)
        ELSE COALESCE(rlt.arrears_ledger, 0)
      END::numeric AS arrears_amt,
      COALESCE(rlt.paid_amt, 0)::numeric AS paid_amt,
      GREATEST(
        0,
        CASE
          WHEN COALESCE(rlt.term_fee, 0) > 0 THEN rlt.term_fee
          ELSE COALESCE(stf.structure_term_fee, 0)
        END
        + CASE
            WHEN EXISTS (SELECT 1 FROM prev_closed_term)
              THEN COALESCE(sa.arrears_amt, 0)
            ELSE COALESCE(rlt.arrears_ledger, 0)
          END
        - COALESCE(rlt.paid_amt, 0)
      )::numeric AS outstanding_amt,
      COALESCE(stf.has_fee_structure, false) AS has_fee_structure
    FROM students s
    LEFT JOIN raw_ledger_totals rlt ON rlt.student_id = s.id
    LEFT JOIN snapshot_arrears sa ON sa.student_id = s.id
    LEFT JOIN structure_term_fees stf ON stf.student_id = s.id
    WHERE s.tenant_id = $1
  )`;
