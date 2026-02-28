# Finance Module Refactor – Deliverables

This document confirms how the School Management System finance module satisfies the refactor requirements for **cumulative balances**, **arrears**, **credits**, **term switching**, and **promotions**.

---

## 1. Database Structure (Strict)

- **student_ledger**  
  - Columns: `id`, `tenant_id`, `student_id`, `academic_year_id`, `term_id`, `description`, `entry_type`, `debit`, `credit`, `created_at`, `receipt_number`, `payment_method`.  
  - All money columns use **NUMERIC(12,2)** (no FLOAT).  
  - Defined in `backend/src/db/connection.ts` and referenced in `backend/src/db/schema-finance-ledger.sql`.

- **fee_structures** (as **ledger_fee_structures**)  
  - Columns: `id`, `tenant_id`, `class_id`, `academic_year_id`, `term_id`, `tuition_fee`, `pta_fee`, `exam_fee`, `total` (all NUMERIC).  
  - Same migration and schema reference as above.

- **Duplicate fee posting**  
  - Prevented by unique index on `(tenant_id, student_id, academic_year_id, term_id)` **WHERE** `entry_type = 'term_fee'` (one term-fee row per student per term per year).

---

## 2. Business Logic

- **Posting term fees**  
  - One new **debit** row per student per term.  
  - No deletion, overwrite, or modification of existing ledger rows.  
  - No balance reset.  
  - Implemented in `postFeesForClass()` in `backend/src/services/ledgerFinanceService.ts`.

- **Payments**  
  - One **credit** row per payment.  
  - No updates to previous ledger rows.  
  - Implemented in `recordPayment()` in the same service; uses a DB transaction.

- **Cumulative balance (always)**  
  - Single allowed pattern (no term filter):
    ```sql
    SELECT COALESCE(SUM(debit),0) AS total_debit,
           COALESCE(SUM(credit),0) AS total_credit,
           COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS balance
    FROM student_ledger
    WHERE tenant_id = $1 AND student_id = $2;
    ```
  - Used in `getStudentSummary()` and `getClassSummary()` (constant `MAIN_BALANCE_SQL`).

- **Status**  
  - `balance > 0` → `"owing"`  
  - `balance = 0` → `"cleared"`  
  - `balance < 0` → `"credit"`

- **Term-specific summary (optional)**  
  - Used only for reporting (e.g. optional `term_summary` in GET student summary when `academicYearId` and `termId` are provided).  
  - **Not** used for main balance calculation.

---

## 3. Promotion Logic

- Update **student.class_assigned_id** (e.g. in students route).  
- Insert **new term fee** for the new class as a new ledger row (via POST post-fees for the new class).  
- Do **not** delete or reset old ledger rows.  
- Cumulative balance continues automatically (same `MAIN_BALANCE_SQL`).  
- Documented in `backend/FINANCE_LEDGER_README.md` and demonstrated in `backend/scripts/seed-ledger-example.ts`.

---

## 4. New Term Logic

- New term fee is inserted as a **new debit** row (post-fees).  
- Previous balance is **not** reset.  
- Arrears carry forward (balance = sum of all debits − sum of all credits).  
- No separate “arrears row”; balance is always derived from the cumulative query above.

---

## 5. Endpoints

| Endpoint | Behaviour |
|----------|-----------|
| **GET /api/finance/student/:id/summary** | Returns `total_debit`, `total_credit`, `balance`, `status` (`"owing"` \| `"cleared"` \| `"credit"`), full ledger history (ASC). Balance is cumulative (no term filter). |
| **POST /api/finance/post-fees** | Body: `classId`, `academicYearId`, `termId`. Posts term fee for all students in the class. Duplicate posting prevented by unique index. |
| **POST /api/finance/payment** | Body: `studentId`, `academicYearId`, `termId`, `amount`, optional `description`, `paymentMethod`, `receiptNumber`. Inserts one credit row inside a transaction. |

Implemented in `backend/src/routes/finance.ts` with validation and error handling.

---

## 6. Safety Rules

- **NUMERIC** used for all money (no FLOAT).  
- Balance is **never** calculated or stored in the frontend; only the API returns computed balance.  
- Ledger rows are **never** overwritten or deleted by the finance module.  
- Payments use **database transactions** (BEGIN/COMMIT/ROLLBACK).  
- Duplicate fee posting is prevented by the unique index on term-fee rows.

---

## 7. Examples (Behaviour)

- **Student paid nothing**  
  - Term 1: Fee 1000 → Balance 1000.  
  - Term 2: Fee 1200 → Balance 2200 (arrears carried forward).

- **Student partial payment**  
  - Term 1: Fee 1000, Paid 600 → Balance 400.  
  - Term 2: Fee 1200 → Balance 1600.  
  - Paid 1500 → Balance 100.

- **Promotion to new class**  
  - Previous balance 100.  
  - Term 1 Fee JHS2 = 1300 (new debit) → Balance 1400.  
  - Ledger rows remain intact; cumulative balance stays correct; arrears and credit are never lost.

---

## 8. Deliverables Checklist

| Deliverable | Location |
|-------------|----------|
| Updated PostgreSQL schema | `backend/src/db/connection.ts` (migrations), `backend/src/db/schema-finance-ledger.sql` (reference) |
| Correct SQL for cumulative balance | `backend/src/services/ledgerFinanceService.ts` (`MAIN_BALANCE_SQL`, no term filter) |
| Express routes | `backend/src/routes/finance.ts` (student summary, post-fees, payment, class summary, and supporting routes) |
| Service layer | `backend/src/services/ledgerFinanceService.ts` (getStudentSummary, postFeesForClass, recordPayment, getClassSummary) |
| Seed data | `backend/scripts/seed-ledger-example.ts` (run: `npm run seed-ledger` from `backend/`) |
| Error handling | Validation and try/catch in routes and service; 400/404/500 with JSON `{ error: "..." }` |

---

## 9. How to Test

1. Start backend and run migrations (schema already applied on app start).  
2. From `backend/`: `npm run seed-ledger` (requires at least one tenant and one student).  
3. Call `GET /api/finance/student/:id/summary` for the seeded student; confirm cumulative balance (e.g. 2500 in seed scenario).  
4. Switch term / promote student and post new fees; confirm balance carries forward and previous term fees and arrears/credits are preserved.
