# Guide to the New Finance Module

This document provides a step-by-step guide on how to use and test the new ledger-based finance module.

## 1. How it Works

The new finance module is based on an **immutable ledger**. This means:
- Every fee and every payment is a new, separate entry in the `student_ledger` table.
- Old records are **never** updated or deleted.
- A student's balance is **always** calculated in real-time by summing up all their debits (fees) and credits (payments).
- Arrears and credits from previous terms are **automatically carried forward**.

## 2. How to Test

To test the system, you need to ensure you have the necessary data in your database.

### Step 1: Prerequisites - Data you MUST have

Before you can post fees, you need to have the following data in your database for your tenant:

*   **An Academic Year and a Term:** You need at least one academic year and one term. You can create these through your application's interface. Make sure you have the `academic_year_id` and `term_id`.
*   **A Class:** You need at least one class. Make sure you have the `class_id`.
*   **A Student:** You need at least one student assigned to the class you want to test.
*   **A Fee Structure:** This is the most common reason for errors. You MUST have a fee structure that links a **class**, an **academic year**, and a **term** to a fee amount. You can create this in the `ledger_fee_structures` table.

**Example Fee Structure:**
To post fees for `JHS 1` for `Term 1` of the `2025` academic year, you need an entry in `ledger_fee_structures` like this:
- `class_id`: (ID for JHS 1)
- `academic_year_id`: (ID for 2025)
- `term_id`: (ID for Term 1)
- `total`: (The fee amount, e.g., 1200)

### Step 2: Posting Fees

To post fees for a class, make a `POST` request to the following endpoint:

`POST /api/finance/post-fees`

**Request Body:**
```json
{
  "classId": <your_class_id>,
  "academicYearId": <your_academic_year_id>,
  "termId": <your_term_id>
}
```

**How to check if it worked:**
*   Check the backend console logs. I have added detailed logs that show if a fee structure was found, how many students were found, and how many fee entries were created.
*   If you see an error like "Fee structure not found", it means you are missing the data from Step 1.

### Step 3: Checking the Student's Balance

To check a student's balance, make a `GET` request to the following endpoint:

`GET /api/finance/student/:id/summary`

Replace `:id` with the `student_id` of the student you want to check.

**The response will show you:**
*   `total_debit`: The sum of all fees.
*   `total_credit`: The sum of all payments.
*   `balance`: The cumulative balance.
*   `status`: "owing", "cleared", or "credit".
*   `history`: A complete list of all transactions for that student.

## 3. If it's Still Not Working

If you have followed these steps and it is still not working, please provide the following information:
1.  The exact request body you are sending to `POST /api/finance/post-fees`.
2.  The logs from your backend console when you make the request.

This information is essential for me to be able to help you.
