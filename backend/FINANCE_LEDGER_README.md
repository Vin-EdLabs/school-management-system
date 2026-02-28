# Ledger-Based Finance Module

## Core principle
- **Ledger table only**: all movements are rows in `student_ledger`.
- **Never**: store balance, update previous rows, overwrite transactions.
- **Always**: append transactions; compute balance as `SUM(debit) - SUM(credit)` in SQL.
- **Status**: `balance > 0` → owing, `balance = 0` → cleared, `balance < 0` → credit.

## Balance calculation (strict)
- **Main running balance** must include **ALL** ledger records for the student. Do **NOT** filter by `term_id` or `academic_year_id`.
- Correct SQL for main balance only:
  ```sql
  SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(credit),0) AS total_credit,
         COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS balance
  FROM student_ledger WHERE tenant_id = $1 AND student_id = $2;
  ```
- Balance persists across terms, promotions, and academic years (unless explicitly reset).
- **Term-specific summary** (optional, for display only): may use `WHERE ... AND academic_year_id = $3 AND term_id = $4`. This must **never** be used for main balance or any business decision.

## Database (PostgreSQL)
- **academic_years** – id, tenant_id, name, is_current
- **terms** – id, tenant_id, academic_year_id, name, is_current
- **ledger_fee_structures** – class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total (all NUMERIC)
- **student_ledger** – student_id, academic_year_id, term_id, description, entry_type, debit, credit, created_at (NUMERIC)
- **Constraint**: one term-fee per student per term: unique `(tenant_id, student_id, academic_year_id, term_id)` where `entry_type = 'term_fee'`.
- **entry_type** values: `term_fee`, `payment`, `arrears`, `carry_forward_credit`, `carry_forward_debit`, `credit_brought_forward`. `arrears` = debit in new term "Arrears from previous term"; `carry_forward_credit` = closing credit in previous term "Balance carried forward to next term"; `credit_brought_forward` = credit in new term "Credit from previous term"; `carry_forward_debit` = closing debit in previous term for credit balance (keeps cumulative balance correct).

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/student/:id/summary` | total_debit, total_credit, balance, status, full ledger (ASC) |
| POST | `/api/finance/post-fees` | Body: classId, academicYearId, termId – post term fee for all students in class |
| POST | `/api/finance/payment` | Body: studentId, academicYearId, termId, amount, description?, paymentMethod?, receiptNumber? |
| GET | `/api/finance/class/:classId/summary` | total_expected, total_collected, total_outstanding, total_credit, students[] |
| GET | `/api/finance/academic-years` | List academic years |
| GET | `/api/finance/terms?academicYearId=` | List terms for year |
| GET | `/api/finance/fee-structures` | List ledger fee structures (optional filters) |
| POST | `/api/finance/fee-structures` | Create/update fee structure (classId, academicYearId, termId, tuition_fee, pta_fee, exam_fee) |
| POST | `/api/finance/academic-years` | Create academic year |
| POST | `/api/finance/terms` | Create term |
| POST | `/api/finance/close-year` | Body: fromAcademicYearId, toAcademicYearId, toTermId – insert bring-forward entries if carry_forward_balance is false |
| POST | `/api/finance/backfill-arrears` | Backfill arrears for current term (from settings). Idempotent; use when term was switched but arrears rows were not inserted. |

## Business rules
1. **Posting term fees**: one row per student, `entry_type = 'term_fee'`, debit = total fee, credit = 0. No arrears row; balance comes from aggregation.
2. **Payment**: one row, debit = 0, credit = amount. Use DB transaction.
3. **New term with arrears**: post new term fee (debit); ledger total debit increases; balance = sum(debit) - sum(credit) automatically.
4. **Promotion**: update `students.class_assigned_id`; post new term fee for new class. No ledger reset.
5. **New academic year**: if `school_settings.carry_forward_balance = false`, insert closing entry per student (Balance Brought Forward or Credit Brought Forward).
6. **Automatic fee posting and arrears on term switch**: When the current term is changed in Settings (PUT /settings with `current_term` and `current_year`), the backend: (a) resolves the **previous** and **new** ledger terms (creating `academic_years`/`terms` if needed); (b) posts a new term fee for every student who does not already have a `term_fee` row for the new term; (c) for each student with unpaid balance in the **previous** term, inserts a closing credit in the previous term ("Balance carried forward to next term", `entry_type = 'carry_forward_credit'`) and a debit in the new term ("Arrears from previous term", `entry_type = 'arrears'`). Cumulative balance stays correct (SUM(debit)-SUM(credit)); ledger remains append-only. **POST /api/finance/switch-term** accepts optional `currentTermId`; when provided with `newTermId`, runs the same arrears logic.

## Testing (examples)

**Student paid nothing**  
Term 1: Fee 1000 → Balance = 1000.  
Term 2: Fee 1200 → Balance = 2200 (all arrears carried forward).

**Student partial payment**  
Term 1: Fee 1000, Paid 600 → Balance = 400.  
Term 2: Fee 1200 → Balance = 1600. Paid 1500 → Balance = 100.

**Promotion to new class**  
Previous balance = 100. Term 1 Fee JHS2 = 1300 (new debit) → Balance = 1400. Ledger rows remain intact; cumulative balance stays correct; arrears and credit are never lost.

## Seed script (cumulative balance + promotion)

From `backend/` run:

```bash
npm run seed-ledger
```

This seeds one student with: Term 1 fee 1000 + payment 600; Term 2 fee 1200 + payment 1500; Term 3 fee 1100; then promotes to JHS2 and posts Term 1 (new year) fee 1300. Final balance = 2500. Requires at least one tenant and one student (and will create classes/academic years/terms if needed).

## Clearing old data
To test from a clean slate you can clear legacy tables (backup first). See `src/db/seed-ledger-finance.sql`.
