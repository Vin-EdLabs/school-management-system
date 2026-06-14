# SCHOLARNERVE — Fees, Arrears & Receipts

This document explains **how school fees are billed, collected, calculated on receipts, and how arrears work** in the ROSA School Management System. It reflects the **actual implementation** in the codebase (as of June 2026).

---

## Table of contents

1. [Big picture](#1-big-picture)
2. [Key concepts & terminology](#2-key-concepts--terminology)
3. [Setting up fees](#3-setting-up-fees)
4. [How a fee payment is collected](#4-how-a-fee-payment-is-collected)
5. [Receipt calculations (printed snapshot)](#5-receipt-calculations-printed-snapshot)
6. [Live balance (Records page & balance cards)](#6-live-balance-records-page--balance-cards)
7. [How arrears are calculated](#7-how-arrears-are-calculated)
8. [Term activation & carry-forward](#8-term-activation--carry-forward)
9. [Beneficiary / scholarship discounts](#9-beneficiary--scholarship-discounts)
10. [Credit balance (overpayment)](#10-credit-balance-overpayment)
11. [Receipt corrections](#11-receipt-corrections)
12. [Where you see fees in the app](#12-where-you-see-fees-in-the-app)
13. [Edge cases & troubleshooting](#13-edge-cases--troubleshooting)
14. [Database tables](#14-database-tables)
15. [API reference](#15-api-reference)
16. [Source files (for developers)](#16-source-files-for-developers)

---

## 1. Big picture

The system uses **two related finance engines** that work together:

| Engine | Purpose | Used for |
|--------|---------|----------|
| **Student ledger** (`student_ledger`) | Append-only accounting per term: debits (bills) and credits (payments) | **Live balances** — Records page, student balance card, fee breakdown tables |
| **Legacy fee engine** (`fee_structures` + `payments` + `term_arrears`) | String-based term matching | **Receipt snapshots** at payment time, some reports, arrears cache |

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Fee structure  │────▶│  student_ledger  │────▶│  Live breakdown │
│  (per class)    │     │  debits/credits  │     │  (UI balances)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       ▲
         │                       │ payment credit
         ▼                       │
┌─────────────────┐     ┌──────────────────┐
│ fee_structures  │────▶│    payments      │────▶ receipt_snapshot
│ + term_arrears  │     │  (receipt #)     │      (frozen at pay time)
└─────────────────┘     └──────────────────┘
```

**Important:** The number on a **printed receipt** (`receipt_snapshot`) is calculated at payment time using the **legacy engine**. The **Records page** and **balance cards** use the **live ledger breakdown**, which is the current source of truth for “what does this student owe today?”

If those two ever disagree, check whether ledger entries exist and whether `term_arrears` has been refreshed.

---

## 2. Key concepts & terminology

### Academic term

A school period (e.g. **Term 1 2026**). Stored in several places:

| Location | Example | Role |
|----------|---------|------|
| `school_settings.current_term` / `current_year` | `Term 1`, `2026` | Default term for new payments |
| `academic_terms` | `term_name`, `year`, `is_active` | Settings UI; term activation |
| `terms` + `academic_years` | Ledger IDs | `student_ledger.term_id` |
| Payment `term` column | `Term 1 2026` | Which term a receipt belongs to |

### Fee structure

The amount each **class** pays for a **term**. Configured in **Settings → Fees**.

- **Legacy table:** `fee_structures` — `class_id`, `term`, `amount`
- **Ledger table:** `ledger_fee_structures` — synced when fees are saved; used to post `term_fee` debits

### Student ledger

An accounting log per student, per ledger term:

| Column | Meaning |
|--------|---------|
| `debit` | Money the student **owes** (term fee, arrears brought forward, etc.) |
| `credit` | Money the student **paid** |
| `entry_type` | What kind of entry (see below) |

**Ledger entry types:**

| `entry_type` | Meaning |
|--------------|---------|
| `term_fee` | Term bill posted when a term is activated or fees are billed |
| `payment` | Fee payment recorded |
| `arrears` | Unpaid balance carried into the new term |
| `carry_forward_credit` | Marks old term as settled so it is not double-counted |
| `carry_forward_debit` | Related carry-forward adjustment |
| `credit_brought_forward` | Credit moved between terms |
| `payment_correction` | Adjustment from receipt correction |
| `manual_adjustment` | Admin balance override |

### Arrears

**Arrears = unpaid balance from previous term(s)**, shown separately from the current term’s fee.

- On the **live breakdown**: each prior term with `outstanding > 0` becomes its own arrear line.
- In **legacy/receipt math**: stored in `term_arrears` for the current term label.

Arrears are **not** the same as total outstanding — they are only the **prior-term portion**.

### Active student

Only students with `enrollment_status = 'active'` can receive new fee payments. Graduated/alumni students may still have historical balances but cannot pay unless rules allow financial activity on their term.

---

## 3. Setting up fees

### Step 1 — Configure fee structure

1. Go to **Settings → Fees** (or fee configuration for each class).
2. Set amounts per **class** and **term** (e.g. Class 6 → Term 1 2026 → GHS 1,200).
3. Saving creates/updates `fee_structures` and syncs `ledger_fee_structures`.

### Step 2 — Activate the academic term

When admin activates a term (**Settings → Academic terms → Activate**):

1. The term becomes `is_active = true`.
2. `school_settings.current_term` / `current_year` update.
3. **Carry-forward** runs — unpaid balances from old terms move to the new term.
4. **Term fees are billed** — `term_fee` debits posted to `student_ledger` for active enrolled students.
5. **`term_arrears` cache** is refreshed for all students.

**First term ever:** no carry-forward; only term fees are posted.

### Beneficiary students

If a student is marked beneficiary/scholarship, their billed amount may be reduced or waived (see [Section 9](#9-beneficiary--scholarship-discounts)).

---

## 4. How a fee payment is collected

### User flow (Finance → Fees → Record Payment)

1. Staff selects **student**, **term**, **amount**, **payment method/account**, and optional notes.
2. System validates:
   - Student exists and is **actively enrolled**.
   - Amount is positive.
   - Payment account resolves (Cash/Bank/MoMo).
3. System generates a **receipt number** (per-tenant sequence in `receipt_number_seq`).
4. Payment row is inserted into `payments`.
5. **Balance is computed** for that term → **receipt snapshot** is saved on the payment row.
6. **Ledger credit** is posted (`entry_type = 'payment'`).
7. **Arrears cache** refreshes in the background (`refreshArrearsForTenant`).
8. Parent push notification may be sent (if configured).

### What gets stored on `payments`

| Field | Description |
|-------|-------------|
| `student_id` | Who paid |
| `amount` / `amount_paid` | Payment amount (corrected amount used if receipt was corrected) |
| `payment_date` | Date of payment |
| `term` | e.g. `Term 1 2026` |
| `receipt_number` | Unique receipt ID |
| `receipt_snapshot` | JSON balance breakdown **at time of payment** |
| `payment_account_id` | Cash/bank/MoMo account |
| `is_voided` | `true` if receipt was voided by correction |
| `corrected_by_payment_id` | Links to replacement receipt |

### Payment amount in totals

All sums use:

```text
COALESCE(amount_paid, amount, 0)
```

Voided payments are **excluded**:

```text
COALESCE(is_voided, false) = false
```

### Term matching on payments

Payments are matched to terms using **flexible string matching** (handles `Term 1` vs `Term 1 2026`):

- Exact match
- Prefix match (`Term 1` matches `Term 1 2026`)
- Term-only match (`Term 1`)

---

## 5. Receipt calculations (printed snapshot)

When a payment is saved, the system calls `getStudentFeeBalance()` then `buildReceiptSnapshot()`.

### Step A — Compute term balance (`getStudentFeeBalance`)

For the payment’s term:

```text
totalFees  = SUM(fee_structures.amount) for student's class + term
             (after beneficiary discount)

totalPaid  = SUM(payments) for student + term
             (voided payments excluded)

arrears    = SUM(term_arrears.amount) for student + current_term label
             (cached prior-term debt)
```

Then `calculateFeeBalance()` runs:

```text
totalAmountDue = totalFees + arrears
outstanding    = totalAmountDue − totalPaid
```

| Condition | Result |
|-----------|--------|
| `outstanding > 0` | Status **Owing**, credit = 0 |
| `outstanding = 0` | Status **Cleared**, credit = 0 |
| `outstanding < 0` | Status **Credit**, credit = ABS(outstanding) |

### Step B — Build receipt snapshot (`buildReceiptSnapshot`)

Saved as JSON on the payment:

| Snapshot field | Formula | Shown on receipt as |
|----------------|---------|---------------------|
| `termFee` | `totalFees` | Current term fee |
| `arrears` | `arrears` from `term_arrears` | Arrears brought forward |
| `totalDue` | `termFee + arrears` | Total amount due |
| `balanceAfter` | `max(0, outstanding)` | Balance remaining after this payment |
| `credit` | Credit if overpaid | Credit balance (if any) |

**Example**

| Item | Amount |
|------|--------|
| Term fee | GHS 1,200 |
| Arrears | GHS 300 |
| **Total due** | **GHS 1,500** |
| Paid this receipt | GHS 500 |
| **Balance after** | **GHS 1,000** |

If the student pays GHS 1,600 when total due is GHS 1,500:

| Item | Amount |
|------|--------|
| Balance after | GHS 0 |
| Credit | GHS 100 |

### Receipt snapshot is frozen

The snapshot reflects balances **at payment time**. Later term changes, corrections, or new bills do **not** retroactively change old receipts — only new payments get new snapshots.

---

## 6. Live balance (Records page & balance cards)

The **live breakdown** (`getStudentLiveFeeBreakdown`) is the **primary display** on:

- Records page (student lookup)
- Student quick-view balance card
- Fee status / class balance views (via API)

It reads **`student_ledger` per term**, not `term_arrears` directly.

### Per-term ledger aggregation

For each ledger term:

```text
amount_billed = SUM(debit)
amount_paid   = SUM(credit)
term_fee      = SUM(debit WHERE entry_type = 'term_fee')
                (or amount_billed if no term_fee rows)

outstanding   = max(0, amount_billed − amount_paid)
```

Carry-forward entry types (`carry_forward_credit`, etc.) are excluded from “effective outstanding” display calculations.

### Active term summary

Let **active term** = the term marked active in settings (or last term in ledger if unmatched).

```text
currentTermFee = active term's term_fee (or outstanding if fee is 0)

arrearLines    = each PRIOR term where outstanding > 0
                 (fully paid prior terms are NOT included)

totalArrears   = sum of arrear line amounts

totalDue       = currentTermFee + totalArrears

totalPaid      = payments credited ONLY to the active term
                 (NOT lifetime payments across all terms)

outstanding    = max(0, totalDue − totalPaid)

credit         = totalPaid − totalDue   (when totalPaid > totalDue)
```

### Example live breakdown

**Term 1 2025** — billed GHS 1,000, paid GHS 400 → outstanding GHS 600  
**Term 2 2025** — billed GHS 1,200, paid GHS 0 → outstanding GHS 1,200  
**Term 1 2026 (active)** — billed GHS 1,200, paid GHS 500

| Line | Amount |
|------|--------|
| Term fee (current) | GHS 1,200 |
| Arrears — Term 1 2025 | GHS 600 |
| Arrears — Term 2 2025 | GHS 1,200 |
| **Total due** | **GHS 3,000** |
| Paid (Term 1 2026 only) | GHS 500 |
| **Outstanding** | **GHS 2,500** |

### Legacy fallback

If a student has **no ledger rows** yet, the live service falls back to summing `fee_structures` + `payments` per term string (same idea as old reports).

---

## 7. How arrears are calculated

There are **two arrears paths**:

### A — Live breakdown (UI)

Arrears = sum of **unpaid prior terms** from ledger:

```text
For each term BEFORE active term:
  if (amount_billed − amount_paid) > 0 → add to arrearLines
```

Settled prior terms (paid in full) contribute **zero** arrears.

### B — `term_arrears` cache (receipts & legacy)

Table: `term_arrears`  
Unique key: `(tenant_id, student_id, current_term)`

Refreshed by `refreshArrearsForTenant()` after payments and term changes.

**`computeStudentArrearsAmount` logic:**

1. **If ledger history exists** before current term:
   - Sum net `(debit − credit)` for all terms strictly before current.
   - Include `arrears`-type debits on current term.
   - Return `max(0, …)`.

2. **Else legacy fallback:**
   - For each `fee_structures.term` before current term:
     - `unpaid += max(0, discounted_fee − payments_for_that_term)`
   - Return sum.

**Full-fee-waiver beneficiaries:** `term_arrears` rows are **deleted** on refresh; no arrears carried.

---

## 8. Term activation & carry-forward

When a **new term is activated**, `executeTermSwitchWithArrears` runs:

```text
1. For each student with unpaid ledger balance in old term(s):
     - Post "arrears" debit on NEW term
     - Upsert term_arrears cache
     - Post carry_forward_credit on OLD term (prevents double-counting)

2. Post term_fee debits on NEW term from ledger_fee_structures
   (beneficiary-adjusted amounts)

3. Refresh term_arrears for all students
```

**Mental model:**

```text
Old term unpaid  ──carry forward──▶  New term "Arrears" line
New term fee     ──bill──────────▶  New term "Term fee" line
```

Students who fully paid the old term get **no arrears line** on the new term.

---

## 9. Beneficiary / scholarship discounts

Student fields: `is_beneficiary`, `discount_type`, `discount_value`.

| Student setting | Fee charged |
|-----------------|-------------|
| Not beneficiary | Full class fee |
| Beneficiary, no discount type | **Full waiver (GHS 0)** |
| `discount_type = percentage` | Fee reduced by X% (0–100) |
| `discount_type = fixed` | Fee reduced by fixed GHS amount |
| 100% percentage | Treated as full waiver |

Discounts apply to:

- Fee structure totals
- Ledger `term_fee` debits
- Arrears carry-forward (full waiver students skip carry-forward)

---

## 10. Credit balance (overpayment)

Credit happens when a student pays **more than total due** for the active term context.

**Live breakdown:**

```text
if totalPaid > totalDue:
  credit = totalPaid − totalDue
  status = 'Credit'
```

**Legacy / receipt:**

```text
if outstanding < 0:
  credit = ABS(outstanding)
  status = 'Credit'
```

**Common bug that was fixed:** Credit must **not** appear when a student simply has not paid the current term but has old payments on other terms. Live breakdown only counts **current-term payments** in `totalPaid`.

---

## 11. Receipt corrections

Staff can correct a receipt within **7 days** of the original receipt date.

### Correction types

| Type | When | Amount change |
|------|------|---------------|
| **Credit correction** | Student paid more than recorded | Increase payment amount |
| **Debit correction** | Payment was overstated | Decrease payment amount |

### Process

1. Original payment → `is_voided = true`
2. New payment created with corrected amount and new receipt number (`…-R1`, `…-R2`)
3. Ledger `payment_correction` entry posted (delta)
4. New `receipt_snapshot` computed on replacement payment
5. Audit row in `receipt_corrections`

After 7 days the receipt is **locked** and cannot be corrected through the UI.

---

## 12. Where you see fees in the app

| Screen | Data source | What you see |
|--------|-------------|--------------|
| **Record Payment** | Live breakdown API | Term fee, arrears lines, total due, outstanding |
| **Student balance card** | Live breakdown | Same as Records |
| **Records → Profile lookup** | Live breakdown + payment list | Line-by-line fees, receipts (voided flagged) |
| **Print fee status** | Live breakdown batch API | Class fee status report |
| **Printed receipt** | `receipt_snapshot` on payment | Frozen totals at payment time |
| **Financial reports** | Mix of payments, income, ledger | Collections summaries |

### Live breakdown display columns

| Label | Meaning |
|-------|---------|
| Term Fee | Current term bill |
| Arrears (per line) | Unpaid from a specific prior term |
| Total Due | Term fee + all arrears |
| Amount Paid | Payments on **current term only** |
| Outstanding | Total due − amount paid |
| Credit Balance | Overpayment on current term context |

---

## 13. Edge cases & troubleshooting

| Situation | Expected behaviour |
|-----------|-------------------|
| Student inactive / suspended | New payments **blocked** |
| Graduated student | Fees only if that term has payment/arrears history |
| Voided receipt | Excluded from all payment totals; still visible on Records |
| Prior term fully paid | **Not** listed in arrears |
| No ledger data yet | Live breakdown uses legacy fee_structure + payment sums |
| Receipt vs Records mismatch | Receipt uses snapshot at pay time; Records uses live ledger — run term activation / backfill if ledger missing |
| Payment on wrong term | Affects that term’s ledger row; may not reduce current-term outstanding |
| Clear all finance data | Wipes payments, ledger, terms, fee structures — school must reconfigure |

### If balances look wrong

1. Confirm **active term** in Settings matches the term you expect.
2. Check **fee structure** exists for the student’s **class** and **term**.
3. Open **Records** → student → review per-term ledger lines.
4. Run **Refresh arrears** (admin API: `POST /api/fee-calculations/refresh-arrears`) if legacy reports disagree.
5. Verify payments are not **voided** and are tagged to the correct **term** string.

---

## 14. Database tables

### Core fee tables

| Table | Role |
|-------|------|
| `fee_structures` | Class + term fee amounts (legacy) |
| `ledger_fee_structures` | Class + term fees for ledger billing |
| `payments` | All fee receipts |
| `receipt_corrections` | Correction audit trail |
| `receipt_number_seq` | Receipt numbering per tenant |
| `student_ledger` | Debits/credits per student per ledger term |
| `term_arrears` | Cached arrears for current term (legacy engine) |
| `term_outstanding_balances` | Snapshot at carry-forward |
| `academic_terms` | Term records with `is_active` |
| `academic_years` / `terms` | Ledger term dimension |
| `school_settings` | `current_term`, `current_year` |
| `students` | Class, beneficiary flags, `enrollment_status` |

---

## 15. API reference

| Endpoint | Purpose |
|----------|---------|
| `POST /api/payments` | Record fee payment + receipt snapshot |
| `POST /api/payments/:id/correct` | Correct receipt (within 7 days) |
| `GET /api/fee-calculations/students/:studentId/live-breakdown` | Single student live breakdown |
| `GET /api/fee-calculations/students/live-breakdowns?classId=` | Batch for class |
| `GET /api/fee-calculations/arrears-balances` | Map of cached `term_arrears` |
| `POST /api/fee-calculations/refresh-arrears` | Rebuild `term_arrears` cache |
| `GET /api/records/profile-lookup?id=` | Records page student + fees |
| `POST /api/academic-terms/:id/activate` | Activate term + bill + carry-forward |
| `POST /api/finance/switch-term` | Manual ledger term switch |
| `POST /api/finance/clear-all-payments` | Wipe tenant finance (destructive) |

---

## 16. Source files (for developers)

| File | Role |
|------|------|
| `backend/src/services/studentLiveFeeBreakdownService.ts` | **Live balance engine** (Records, balance cards) |
| `backend/src/services/studentFeeBalanceService.ts` | Legacy balance + `buildReceiptSnapshot` |
| `backend/src/services/financeCalculationService.ts` | Core `calculateFeeBalance` formula |
| `backend/src/services/arrearsService.ts` | `term_arrears` compute/refresh |
| `backend/src/services/ledgerFinanceService.ts` | Ledger posting, term switch, backfill |
| `backend/src/services/termActivationService.ts` | Full term activation pipeline |
| `backend/src/services/receiptCorrectionService.ts` | Receipt void/replace/correct |
| `backend/src/utils/beneficiaryFee.ts` | Discount/waiver rules |
| `backend/src/routes/payments.ts` | Payment recording |
| `backend/src/routes/records.ts` | Records profile + live breakdown |
| `backend/src/routes/feeCalculations.ts` | Live breakdown APIs |
| `src/services/liveFeeBreakdown.ts` | Frontend API client |
| `src/components/records/RecordsModule.tsx` | Records fee display |

---

## Quick reference — formulas

### Receipt (at payment time)

```text
totalDue      = termFee + arrears
balanceAfter  = max(0, totalDue − totalPaidIncludingThisPayment)
credit        = max(0, totalPaid − totalDue)
```

### Live balance (Records / balance card)

```text
totalDue      = currentTermFee + sum(priorTermOutstanding where > 0)
outstanding   = max(0, totalDue − currentTermPaymentsOnly)
credit        = max(0, currentTermPaymentsOnly − totalDue)
```

### Arrears (live)

```text
totalArrears  = sum of outstanding for all terms BEFORE active term
                (settled terms excluded)
```

---

*For budget/finance features (non-fee income, expenses, term budgets), see the Finance module documentation separately.*
