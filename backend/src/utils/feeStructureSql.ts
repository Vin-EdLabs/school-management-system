import { sqlBeneficiaryAdjustedAmount } from './beneficiaryFee.js';

/** Active fee_structure_items sum, falling back to ledger_fee_structures.total. */
export const SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL = `COALESCE(
  (SELECT SUM(fsi.amount)::numeric
   FROM fee_structure_items fsi
   WHERE fsi.tenant_id = fs.tenant_id
     AND fsi.fee_structure_id = fs.id
     AND fsi.is_active = true
     AND fsi.amount > 0),
  fs.total,
  0::numeric
)`;

/** Net term_fee debit for student `s` joined to fee structure alias `fs`. */
export const SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE = sqlBeneficiaryAdjustedAmount(
  `(${SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL})`
);

/** Match fee structure class to the student's assigned class row (by id or normalized name). */
export const SQL_FEE_STRUCTURE_CLASS_MATCH = `
  (
    fs.class_id = s.class_assigned_id
    OR EXISTS (
      SELECT 1
      FROM classes c_fs
      WHERE c_fs.id = fs.class_id
        AND c_fs.tenant_id = s.tenant_id
        AND LOWER(TRIM(COALESCE(c_fs.class_name, c_fs.name, ''))) =
            LOWER(TRIM(COALESCE(c_student.class_name, c_student.name, '')))
        AND TRIM(COALESCE(c_fs.class_name, c_fs.name, '')) <> ''
    )
  )
`;
