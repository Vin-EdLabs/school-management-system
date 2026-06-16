# System Architecture Overview

This file describes how the Rosa Management System is structured and how every major portal, module, and service links together. It is organized by role, portal, and system flow.

## 1. System Summary

The application is a multi-tenant school management ecosystem with three main runtime layers:
- **Frontend**: React + TypeScript + Vite application in `src/`
- **Backend**: Express + Node.js + PostgreSQL API in `backend/src/`
- **Database**: PostgreSQL with tenant isolation and ledger-based finance tables

The platform supports:
- school admin and operations
- teacher workflows and grading
- parent portal access and report delivery
- finance and payment management
- audit trail, live notifications, and PWA installability

## 2. High-Level Application Structure

### Frontend entry points
- `src/main.tsx`
  - resolves the active school tenant using hostname, subdomain, or path
  - fetches tenant metadata from `/api/tenant/...`
  - applies tenant-specific PWA branding
  - prepares service worker registration
  - mounts the React app
- `src/App.tsx`
  - loads global providers
  - routes between:
    - landing page
    - super-admin dashboard
    - school portal dashboard
    - parent portal
    - legacy redirect paths

### Backend entry points
- `backend/src/index.ts`
  - configures CORS for known frontend domains and local development
  - enables JSON and form parsing
  - registers tenant and auth middleware
  - mounts dozens of API route modules under `/api/...`
  - initializes Socket.IO for real-time events
  - starts background jobs for finance and teacher suspension

### Data layer
- shared PostgreSQL database
- tenant isolation by `tenant_id` on records
- major tables include:
  - `students`, `teachers`, `classes`, `subjects`, `attendance`, `student_grades`
  - `fee_structures`, `student_ledger`, `payments`, `income`, `expenses`, `payroll`
  - `term_report_releases`, `term_report_comments`
  - `parent_portal_accounts`, `parent_notifications`, `parent_push_subscriptions`

## 3. Portal and Role Breakdown

### Super Admin Portal
Super Admin acts as the global operator for the SaaS platform.

Features:
- create and manage tenant schools
- inspect tenant health and usage
- audit tenant-level activity logs
- view support chat activity and system events
- export/import tenant backups
- reset tenant data and recover from restore files
- create root super-admin users

Key files:
- `src/pages/SuperAdminDashboard.tsx`
- `backend/src/routes/schools.ts`
- `backend/src/routes/schoolRegistrations.ts`
- `backend/src/routes/tenantBackup.ts`
- `backend/src/routes/audit.ts`

### School Administrator Portal
School administrators get the full school management console.

Core modules in `src/components/Dashboard.tsx`:
- `DashboardHome` and `AdministratorDashboard`
- `StudentsModule`
- `TeachersModule`
- `OtherStaffModule`
- `ClassesModule`
- `CalendarModule`
- `FeesModule`
- `IncomeModule`
- `ExpensesModule`
- `PayrollModule`
- `Reports` and `FinancialDashboard`
- `SettingsModule`
- `UsersModule`
- `AuditModule`
- `RecordsModule`
- `SubjectsModule`
- `SupportModule`
- `PushNotificationsModule`
- `ParentDeskAdminModule`
- `ParentAccountsModule`
- `TermBudgetModule`
- `ManualAdjustmentsReport`

This portal is the primary operational console for administrators and business users.

### Teacher Portal
Teacher workflows are a first-class part of the system.

Teacher-specific modules include:
- `TeacherDashboard`
- `TeacherClassesModule`
- `AttendanceModule`
- `GradesModule`
- `TeacherQuizModule`
- `TeacherProfileModule`
- `TeacherAppointmentLettersModule`
- `TeacherPaymentHistoryModule`

Teacher portal capabilities:
- mark attendance
- create and manage grade assignments
- input grades and quiz scores
- calculate weighted term scores for class/subject
- publish report remarks and term results
- view assigned classes and students
- manage personal teaching profile
- view payments and appointment letters

Key backend routes:
- `backend/src/routes/grades.ts`
- `backend/src/routes/attendance.ts`
- `backend/src/routes/teachers.ts`
- `backend/src/routes/subjects.ts`

### Finance Portal
The finance module is built around an immutable ledger and student-specific financial statements.

Finance features:
- define fee structures per class, term, and year
- post student fees automatically for classes and terms
- record payments with receipt generation
- capture income and expense transactions
- manage payroll and salary payments
- run cash bank reconciliation
- generate student finance statements and fee status reports
- support manual balance overrides and ledger corrections
- support term budget planning and expenses versus revenue
- create audit-ready financial exports and PDFs

Finance modules:
- `FinanceStatementModule`
- `TransactionsPage`
- `CashBankModule`
- `TermBudgetModule`
- `ManualAdjustmentsReport`

Key backend routes:
- `backend/src/routes/finance.ts`
- `backend/src/routes/fees.ts`
- `backend/src/routes/payments.ts`
- `backend/src/routes/income.ts`
- `backend/src/routes/expenses.ts`
- `backend/src/routes/payroll.ts`
- `backend/src/routes/paymentAccounts.ts`
- `backend/src/routes/reports.ts`

### Parent Portal
Parents access a dedicated portal that is separate from school-admin login.

Parent portal capabilities include:
- log in using student admission number / ID
- view current fee status, outstanding balance, and credit
- review payment receipts
- see attendance summary and absence notices
- view classroom grades and term report card
- print or export the terminal report card
- receive push notifications and alerts
- link sibling students together
- access a student learning mode view

Key files:
- `src/pages/ParentPortal.tsx`
- `src/components/parent/StudentLearningMode.tsx`
- `src/components/parent/ParentAccountsModule.tsx`
- `backend/src/routes/parent.ts`

Parent portal APIs:
- `/api/parent/login`
- `/api/parent/refresh`
- `/api/parent/me`
- `/api/parent/grades`
- `/api/parent/term-report`
- `/api/parent/push/public-key`
- `/api/parent/push/subscribe`
- `/api/parent/push/unsubscribe`
- `/api/parent/notifications`
- `/api/parent/notifications/read-all`

### Academic and Report Ecosystem
The system supports full academic cycles and reporting.

Academic features:
- manage classes, class levels, and subject assignments
- assign teachers to streams and classes
- maintain academic terms and calendars
- capture attendance and daily class presence
- create grade assignments and record student scores
- compute classroom rankings and positions
- produce detailed terminal report cards for students
- release reports to parents and notify them automatically
- store teacher remarks and headmaster notes

Key backend routes:
- `backend/src/routes/classes.ts`
- `backend/src/routes/classLevels.ts`
- `backend/src/routes/academicTerms.ts`
- `backend/src/routes/academicCycle.ts`
- `backend/src/routes/records.ts`
- `backend/src/routes/reports.ts`

## 4. What the System Achieves

This platform is designed to deliver an integrated school management ecosystem that combines:
- **Academic management**: classes, attendance, grades, term reports
- **Financial management**: fees, payments, ledger balances, payroll, budgets
- **Parent engagement**: portals, notifications, reports, student learning support
- **Staff workflows**: teachers and finance staff operate in their role-specific areas
- **Real-time communication**: notifications, support chat, live data updates
- **Multi-tenancy**: serve many schools on one shared database safely
- **PWA readiness**: installable, branded, offline-aware frontend experience
- **Auditability**: detailed action logs and immutable ledger behavior

## 5. How the Ecosystem Connects

### Tenant and session flow
1. User visits the app URL.
2. `src/main.tsx` resolves the tenant from host or path.
3. frontend calls `/api/tenant/resolve` or `/api/tenant/by-slug/<slug>`.
4. backend returns tenant metadata, branding, colors, and school details.
5. `SchoolContext` persists tenant info for the session.
6. `AuthContext` stores JWT auth state and user role.
7. requests to `/api/...` include tenant headers or are scoped via JWT.
8. backend middleware validates tenant access and turns requests into SQL queries.

### Routing and module selection
- `src/App.tsx` decides which top-level route to render.
- `Dashboard.tsx` chooses the active school portal module based on role and permissions.
- Sidebar navigation is built from available modules in `Sidebar.tsx`.
- `hasAccess()` in `AuthContext.tsx` enforces which modules each role can open.

### Real-time updates
- Socket.IO is initialized in `backend/src/index.ts`.
- frontend `SocketProvider` subscribes to `tenant:<tenantId>` channels.
- events like grade updates, payment records, and notification changes are pushed live.

### PWA and branding
- `src/main.tsx` calls `applyTenantPwaBranding()`.
- tenant assets and metadata are applied before the service worker is registered.
- `public/sw.js` serves offline behavior and push notifications.

## 6. Detailed Portal Features

### Administrator / School Portal
#### Student management
- add/edit/delete student records
- assign students to classes and sections
- promote students across year groups
- manage student profiles and guardian contacts

#### Teacher and staff management
- create and update teacher profiles
- map teachers to subjects and classes
- manage non-teaching staff
- review staff payment history

#### Class and subject management
- create class groups and streams
- assign subjects to classes
- manage academic levels and curriculum structure

#### Attendance
- record daily attendance
- view attendance summaries
- flag absences, late arrivals, and absence notifications

#### Grading and exams
- create assignments and exam items
- record and update student grade scores
- audit every grade change
- compute term results by class and subject
- generate term-report summaries for parents

#### Reports and analytics
- financial reports, student performance reports, and activity summaries
- advanced reports module for exported reports
- visual dashboards and summary cards

#### Finance and ledger operations
- issue fees to students by class/term
- capture payments and receipts
- run income and expense entries
- handle payroll disbursements
- generate student ledger statements
- create cash bank and term budget reports
- support manual adjustments and override incorrect values

#### Communication and support
- push notifications to parents and staff
- support chat and parent desk
- create global announcements and school messages
- export receipts, statements, and analytics

### Teacher portal
Teacher module is optimized for educators:
- view assigned classes and schedules
- mark attendance and student participation
- create quizzes and online assessments
- enter grades and compare class performance
- release term reports and send notifications
- access personal profile, payment history, and appointment letters

### Parent portal
Parent access is secure and focused on student progress.

Capabilities:
- login with student admission ID
- change parent portal password
- view student fee status and receipts
- see attendance and absence summaries
- explore grade breakdowns and report cards
- print terminal reports directly from browser
- receive notifications via web push or FCM
- access student learning mode content

### Super admin portal
Super administrator sees the SaaS platform as a whole:
- onboard schools and create school portals
- inspect tenant-level support and audit logs
- export/import tenant backups
- reset school operational data when needed
- manage super-admin users and credentials

## 7. Backend Route Map

### Core tenant and auth routes
- `/api/auth/*` — login, logout, user profile, password management
- `/api/tenant/*` — resolve tenant by slug/id, tenant metadata
- `/api/schools/*` — school and tenant configuration
- `/api/settings/*` — school settings, academic term settings
- `/api/academic-terms/*` — term CRUD operations
- `/api/system/*` — system utilities and health

### Academic routes
- `/api/students/*`
- `/api/teachers/*`
- `/api/other-staff/*`
- `/api/classes/*`
- `/api/class-levels/*`
- `/api/subjects/*`
- `/api/attendance/*`
- `/api/grades/*`
- `/api/enrollments/*`
- `/api/records/*`
- `/api/events/*`

### Finance and payments
- `/api/fees/*`
- `/api/payments/*`
- `/api/income/*`
- `/api/expenses/*`
- `/api/payroll/*`
- `/api/finance/*`
- `/api/payment-accounts/*`
- `/api/term-budgets/*`
- `/api/reports/*`

### Parent portal and communication
- `/api/parent/*`
- `/api/announcements/*`
- `/api/super/announcements/*`
- `/api/support-chat/*`
- `/api/global-chat/*`
- `/api/conversations/*`
- `/api/messages/*`

### Utility and system operations
- `/api/pwa/*`
- `/api/visit/*`
- `/api/audit/*`
- `/api/school-registrations/*`
- `/api/tenant-backup/*`

## 8. Key Technical Patterns

### Multi-tenancy
- Shared database and schema
- Tenant-scoped rows by `tenant_id`
- Tenant resolution by slug or ID in HTTP headers
- Super admin route exceptions for cross-tenant management

### Authorization and role-based access
- `AuthContext` defines roles and permitted modules
- roles: `super-admin`, `administrator`, `finance`, `teacher`, `staff`
- each module checks `hasAccess(module)` before rendering
- backend middleware enforces role-based access on routes

### Immutable finance ledger
- fees and payments are appended to ledger tables
- current balances are calculated from debit/credit sums
- helps prevent accidental balance corruption
- enables audit-friendly reconciliation and arrears carryover

### Audit and traceability
- grade updates are logged in `grade_audit_log`
- finance actions use audit notes and actor metadata
- parent account actions are recorded and secured
- administrative actions surface in audit modules

### Real-time UI updates
- Socket.IO broadcasts tenant-level updates
- finance and grade changes can trigger live refresh events
- notifications and support chat flows are live-capable

### PWA and offline-style support
- tenant-specific manifest and branding is applied on load
- service worker is registered on supported hosts
- push subscription endpoints are available for parent portal

## 9. Developer Map

### Important frontend files
- `src/main.tsx`
- `src/App.tsx`
- `src/components/Dashboard.tsx`
- `src/components/Sidebar.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/SchoolContext.tsx`
- `src/services/api.ts` and related service wrappers
- `src/pages/ParentPortal.tsx`
- `src/pages/SuperAdminDashboard.tsx`
- `src/pages/LandingPage.tsx`

### Important backend files
- `backend/src/index.ts`
- `backend/src/routes/grades.ts`
- `backend/src/routes/finance.ts`
- `backend/src/routes/parent.ts`
- `backend/src/routes/schools.ts`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/tenantResolver.js`
- `backend/src/db/connection.js`
- `backend/src/socket.ts`

## 10. How to Use This File

Copy this document into your system documentation or README section to explain how the Rosa Management System works at the architecture level.

Use this as a reference when you need to:
- explain what each portal does
- describe how tenant isolation works
- show which backend routes support each feature
- understand the end-to-end flow between the UI, API, and database
- onboard new developers or stakeholders to the system
