/** School-visible teachers (not soft/hard deleted). */
export const TEACHER_VISIBLE_WHERE = `COALESCE(t.status, 'active') NOT IN ('soft_deleted', 'hard_deleted') AND t.deleted_at IS NULL AND COALESCE(t.is_deleted, false) = false`;

/** Active main teachers only — used for headcount / dashboard stats. */
export const TEACHER_COUNTABLE_WHERE = `${TEACHER_VISIBLE_WHERE} AND COALESCE(t.status, 'active') = 'active' AND t.parent_teacher_id IS NULL`;

/** Active main teachers eligible for payroll (assistants excluded). */
export const TEACHER_PAYROLL_WHERE = `${TEACHER_VISIBLE_WHERE} AND COALESCE(t.status, 'active') = 'active' AND t.parent_teacher_id IS NULL`;

/** Main teachers (not assistants) in school lists. */
export const TEACHER_MAIN_WHERE = `t.parent_teacher_id IS NULL`;

/** Active main teachers — parent picker when assigning assistants. */
export const TEACHER_MAIN_ACTIVE_WHERE = `${TEACHER_VISIBLE_WHERE} AND COALESCE(t.status, 'active') = 'active' AND t.parent_teacher_id IS NULL`;

/** Bare column variants (single-table WHERE, no alias). */
export const TEACHER_VISIBLE_WHERE_BARE = `COALESCE(status, 'active') NOT IN ('soft_deleted', 'hard_deleted') AND deleted_at IS NULL AND COALESCE(is_deleted, false) = false`;
export const TEACHER_COUNTABLE_WHERE_BARE = `${TEACHER_VISIBLE_WHERE_BARE} AND COALESCE(status, 'active') = 'active' AND parent_teacher_id IS NULL`;
export const TEACHER_PAYROLL_WHERE_BARE = `${TEACHER_VISIBLE_WHERE_BARE} AND COALESCE(status, 'active') = 'active' AND parent_teacher_id IS NULL`;
export const TEACHER_MAIN_WHERE_BARE = `parent_teacher_id IS NULL`;
export const TEACHER_MAIN_ACTIVE_WHERE_BARE = `${TEACHER_VISIBLE_WHERE_BARE} AND COALESCE(status, 'active') = 'active' AND parent_teacher_id IS NULL`;

/** Other staff included in dashboard / headcount stats. */
export const OTHER_STAFF_COUNTABLE_WHERE = `COALESCE(o.is_deleted, false) = false AND COALESCE(o.counts_as_staff, true) = true AND COALESCE(o.employment_status, 'active') = 'active'`;

export const OTHER_STAFF_COUNTABLE_WHERE_BARE = `COALESCE(is_deleted, false) = false AND COALESCE(counts_as_staff, true) = true AND COALESCE(employment_status, 'active') = 'active'`;

/** Other staff visible in school admin lists. */
export const OTHER_STAFF_VISIBLE_WHERE = `COALESCE(o.is_deleted, false) = false`;

export const OTHER_STAFF_VISIBLE_WHERE_BARE = `COALESCE(is_deleted, false) = false`;

/** Real name for payroll / payment history (keeps name after soft or hard removal). */
export const TEACHER_PAYROLL_DISPLAY_NAME_SQL = `COALESCE(NULLIF(TRIM(t.removed_original_name), ''), NULLIF(NULLIF(TRIM(t.full_name), ''), '[Removed]'))`;
export const OTHER_STAFF_PAYROLL_DISPLAY_NAME_SQL = `COALESCE(NULLIF(TRIM(s.removed_original_name), ''), NULLIF(NULLIF(TRIM(s.full_name), ''), '[Removed]'))`;

/** Same as above with linked expense payee_name fallback (per payment row). */
export const TEACHER_PAYROLL_DISPLAY_NAME_WITH_EXPENSE_SQL = `COALESCE(${TEACHER_PAYROLL_DISPLAY_NAME_SQL}, NULLIF(NULLIF(TRIM(e.payee_name), ''), '[Removed]'))`;
export const OTHER_STAFF_PAYROLL_DISPLAY_NAME_WITH_EXPENSE_SQL = `COALESCE(${OTHER_STAFF_PAYROLL_DISPLAY_NAME_SQL}, NULLIF(NULLIF(TRIM(e.payee_name), ''), '[Removed]'))`;

export const TEACHER_PAYROLL_DISPLAY_STAFF_ID_SQL = `COALESCE(NULLIF(TRIM(t.removed_original_staff_id), ''), CASE WHEN t.staff_id::text LIKE '__removed_%' THEN NULL ELSE t.staff_id END)`;
export const OTHER_STAFF_PAYROLL_DISPLAY_STAFF_ID_SQL = `COALESCE(NULLIF(TRIM(s.removed_original_staff_id), ''), CASE WHEN s.staff_id::text LIKE '__removed_%' THEN NULL ELSE s.staff_id END)`;

/** Bare column expressions (no table alias) for single-table SELECTs. */
export const TEACHER_PAYROLL_DISPLAY_NAME_BARE = `COALESCE(NULLIF(TRIM(removed_original_name), ''), NULLIF(NULLIF(TRIM(full_name), ''), '[Removed]'))`;
export const OTHER_STAFF_PAYROLL_DISPLAY_NAME_BARE = `COALESCE(NULLIF(TRIM(removed_original_name), ''), NULLIF(NULLIF(TRIM(full_name), ''), '[Removed]'))`;

/** Role/position from staff profile (not class assignment or employment type). */
export const TEACHER_PAYROLL_ROLE_SQL = `COALESCE(NULLIF(TRIM(t.position), ''), NULLIF(ARRAY_TO_STRING(t.subjects_taught, ', '), ''), 'Teacher')`;
export const OTHER_STAFF_PAYROLL_ROLE_SQL = `COALESCE(NULLIF(TRIM(s.position), ''), 'Staff')`;
