# Grades, Online Exams, Term Reports, and IT — How It Works

This document describes how grading, online examinations, term report generation, and IT/technical operations work in the school management system. Use this as both an administrator guide and a reference for teachers and IT staff.

---

## 1. Grades

### 1.1 Overview
- Grades represent student performance for assessments (assignments, quizzes, exams, practicals).
- The system supports configurable grading scales (percentage, letter grades) and weighted assessments.

### 1.2 Grade Components
- Assessment types: `Assignment`, `Quiz`, `Test`, `Exam`, `Practical`, `Project`.
- Each component may have a weight (e.g., Exam 60%, Coursework 40%). Weights sum to 100% per subject/term configuration.
- Teachers enter individual assessment scores; the system computes weighted totals automatically.

### 1.3 Gradebook Workflow
- Create or configure assessment items for a subject and term.
- Assign maximum marks and weighting.
- Enter student scores (bulk CSV import and manual entry supported).
- The gradebook computes:
  - Raw score (sum of assessment scores)
  - Percentage = (raw / max) * 100
  - Weighted contribution = percentage * (weight / 100)
  - Final term mark = sum of weighted contributions
  - Letter or descriptor mapping (if enabled)

### 1.4 Grading Rules & Rounding
- Rounding: final numeric marks are rounded to two decimal places by default.
- Missing scores treated as zero unless marked as `excused`.
- Late submissions: optional penalty rules can be configured per assessment.

### 1.5 Overrides & Moderation
- Moderators or authorized staff may override individual marks with an audit log entry.
- The system records who modified the grade and why (comment required for overrides).

### 1.6 Exporting and Reporting
- Export gradebook as CSV or XLSX for archival or external processing.
- Integrates with term report generation for auto-populating subject marks.

---

## 2. Online Exams

### 2.1 Overview
- Online exams are timed assessments delivered through the system: multiple choice, short answer, long answer, file upload, and other interactive question types.
- Exams can be auto-graded (objective questions) or manually graded (essays, uploads).

### 2.2 Exam Setup
- Create an exam with title, term, subject, start/end times (or an availability window), duration, maximum marks, and access settings.
- Select a question bank or add exam-specific questions.
- Configure rules: randomize questions, shuffle answers, time limit, attempts allowed, open-book allowed or not.
- Attach proctoring requirements or IP restrictions if required.

### 2.3 Question Bank
- Questions are stored centrally and can be tagged by subject, topic, difficulty, and learning outcome.
- Reuse questions across exams; support for question pools and random draws per student.

### 2.4 Student Experience
- Students authenticate with their school account.
- During the exam: progress autosaves frequently; a visible timer shows remaining time.
- For file uploads, allowed file types and size limits are enforced.
- At submission, objective questions are auto-graded and results saved; manual grading items are queued for teachers.

### 2.5 Grading & Feedback
- Auto-graded items update student grade immediately.
- Teachers grade essays/uploads via the grading UI — assignments placed into a worklist.
- Feedback and marks are released according to exam release policy (immediate, after moderation, or on a scheduled date).

### 2.6 Academic Integrity
- Options: lock navigation (prevent leaving tab), limit simultaneous logins, IP whitelisting, and session logging.
- For high-stakes exams, integrate external proctoring or require human invigilation plus submission verification.

### 2.7 Data & Audit
- Store all submissions and attempt logs for auditability.
- Retain exam logs for configurable retention period (recommended 1 year minimum).

---

## 3. Term Reports

### 3.1 Overview
- Term reports aggregate student marks, teacher comments, attendance summaries, and behavioral indicators into a printable/digital report.
- Template-driven: the system supports multiple report templates with configurable sections.

### 3.2 Data Sources
- Subject marks: pulled from the gradebook and exam results.
- Attendance: aggregated from daily attendance records.
- Teacher comments: entered per subject and optionally an overall remark.
- Extra-curricular / conduct: optional fields recorded by staff.

### 3.3 Generation Flow
1. Ensure grading and exam marking for the term are complete.
2. Teachers finalize marks and add comments.
3. Admin triggers report generation (preview available per class).
4. System compiles the data and renders the PDF (or web view) per student.
5. Optional: Batch email or publish reports to parent/student portals.

### 3.4 Template & Customization
- Templates define sections, logos, school headers, subject layouts, and pass/fail thresholds.
- Support for custom remarks and formatting; admin may upload a header/footer or school letterhead.

### 3.5 Scheduling & Distribution
- Generate on-demand or schedule for a release date.
- Distribution options: download ZIP, email individual parents, publish to portal (with access control).

---

## 4. IT / System & Operations

### 4.1 Overview
- This section covers infrastructure, backup, security, integration points and common troubleshooting steps.

### 4.2 Hosting & Requirements
- Recommended stack (matching the project): Node.js backend, PostgreSQL database, and a static asset host (e.g., CDN). The frontend runs as a SPA (Vite/React).
- Minimum resources depend on school size; for small schools, a single t3.small-equivalent VM + managed Postgres is adequate. Scale horizontally for larger usage.

### 4.3 Backups & Disaster Recovery
- Daily DB backups (logical or physical) with weekly full snapshots retained longer.
- Offsite backup storage and periodic restore tests.
- Store application config/environment secrets securely (Key Vault, Vault, environment variables, etc.).

### 4.4 Security & Access Control
- Use role-based access control (admins, teachers, finance, support, parents/students limited view).
- TLS for all web traffic; enforce HSTS.
- Rate-limiting on endpoints that accept user input (exams, submissions) and audit-sensitive endpoints (grade overrides, corrections).
- Maintain audit logs for payments, corrections, grade overrides, and report generation.

### 4.5 Integrations
- Email/SMS gateways for notifications and report delivery.
- Payment gateways for online payments (PCI considerations; do not store raw card data unless PCI compliant).
- Optional integration with external SIS or learning platforms via API.

### 4.6 Monitoring & Alerts
- Monitor app and DB metrics (CPU, memory, connection count, errors per minute).
- Alert on failed cron jobs (report generation), repeated login failures, and payment processing errors.

### 4.7 Common Troubleshooting
- Grade mismatch: re-run gradebook computation; ensure overrides/audit entries are inspected.
- Missing exam submissions: check attempt logs and file storage; verify user connectivity and exam window.
- Report generation failures: inspect template errors and data completeness for required fields.

### 4.8 Operational Policies
- Data retention: align with local regulations (e.g., educational records retention). Keep backups for recovery but minimize exposure.
- Change control: use staging environment for testing releases; schedule maintenance windows for major upgrades.

---

## 5. Roles & Responsibilities (Suggested)
- Head of Academics / Exams Officer: Exam scheduling, question bank approval, final sign-off.
- Teachers: Create assessments, grade, add comments, review exam queues.
- IT / Systems Admin: Hosting, backups, monitoring, user accounts, security patches.
- Finance: Manage fee structures, payment reconciliation, refunds, and corrections.

---

## 6. Appendix: Quick Checklists

### Teacher pre-term checklist
- Configure assessment weights for each subject.
- Populate question bank or exam items.
- Verify student enrollments and class lists.

### IT pre-exam checklist
- Verify server load capacity and backups.
- Confirm TLS certificate validity.
- Ensure autosave/submission storage is operational.

### Report release checklist
- Confirm all marks graded and moderated.
- Validate attendance data for the term.
- Generate preview for leadership and approve distribution.

---

If you'd like, I can split this into separate files (`grades.md`, `online-exams.md`, `term-reports.md`, `it.md`), add screenshots, or produce a printable PDF. Tell me which option you prefer.