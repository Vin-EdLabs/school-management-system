# ScholarNerve — School Management System

**ScholarNerve** (also referenced in code as EDUNERVE / Rosa Gardens) is a full-stack, multi-tenant school management platform for JHS and primary schools. It covers academics, timetables, finance, online payments, attendance, payroll, parent communication, school websites, a partner referral program, internal messaging, and mobile-friendly PWA portals — all in one system with strict data isolation per school.

---

## Table of Contents

- [What This System Does](#what-this-system-does)
- [Who Uses It](#who-uses-it)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Complete Feature List](#complete-feature-list)
  - [Core, Auth & Multi-Tenancy](#core-auth--multi-tenancy)
  - [Public & Landing](#public--landing)
  - [Dashboards & Overview](#dashboards--overview)
  - [Students & Enrollment](#students--enrollment)
  - [Teachers & Staff](#teachers--staff)
  - [Classes, Subjects & Academic Structure](#classes-subjects--academic-structure)
  - [Grades, Assessments & Term Reports](#grades-assessments--term-reports)
  - [Timetable](#timetable)
  - [Attendance & Check-in](#attendance--check-in)
  - [Messaging & Communication](#messaging--communication)
  - [Financial Operations & Paystack](#financial-operations--paystack)
  - [Transport](#transport)
  - [Parent Portal (PWA)](#parent-portal-pwa)
  - [School Public Website](#school-public-website)
  - [Partners Program](#partners-program)
  - [Platform Super Admin](#platform-super-admin)
  - [ID Cards & Verification](#id-cards--verification)
  - [Innovation, Settings & System Tools](#innovation-settings--system-tools)
- [Real-Time & Notifications](#real-time--notifications)
- [Background Jobs (Cron)](#background-jobs-cron)
- [Progressive Web App (PWA)](#progressive-web-app-pwa)
- [Security & Roles](#security--roles)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Production Notes](#production-notes)
- [Additional Documentation](#additional-documentation)

---

## What This System Does

ScholarNerve helps schools run day-to-day operations digitally:

- Register and manage **students, teachers, staff, and parents**
- Build **class and exam timetables** with per-class schedules, break columns, and teacher reminders
- Mark **class attendance** and track **campus check-in/out** (QR-based)
- Record **grades**, build **report cards**, run **online quizzes**, and publish **term positions**
- Collect **fees**, issue **receipts**, accept **Paystack online payments**, manage **invoices**, and run **payroll**
- Communicate with **parents** (Parent Desk), **staff** (internal chat), **platform support**, and **partners**
- Send **push notifications** to parents, teachers, and staff (including class-start alerts)
- Publish a **public school website** with admissions and careers forms
- Run a **partner referral program** with commissions and training
- Give each school its own **subdomain**, branding, and isolated data

Everything is built around **multi-tenancy**: many schools share one application, but each school’s data is separated by `tenant_id`.

---

## Who Uses It

| User | Portal | Main capabilities |
|------|--------|-------------------|
| **Platform super admin** | Obfuscated admin URL (`/tn-7x4k2`) | Manage all schools, registrations, Paystack, partners, support, audits, backups |
| **School administrator** | School subdomain or `/school/:id` | Full school setup, users, finance, timetables, reports, website CMS |
| **Finance team** | Same as admin (finance modules) | Fees, ledger, Paystack, payroll, payment proofs, budgets |
| **Headmaster** | School portal + oversight views | School-wide read-only views + optional teaching + my schedule |
| **Teacher / staff** | School portal | Classes, attendance, grades, quizzes, timetables, staff clock, chat |
| **Driver / other staff** | School portal | Staff clock, messages, limited modules |
| **Parents** | Parent PWA (`/portal`) | Grades, fees, Paystack pay, attendance, message school, check-in, quizzes |
| **Partners** | Partners subdomain | Refer schools, track commissions, training academy, support chat |

---

## Tech Stack

### Frontend (`/`)

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Vite 5 |
| Components | Radix UI, shadcn-style components, Tailwind CSS (light + dark mode) |
| Routing | React Router DOM 6 |
| Data | TanStack React Query, React Context |
| Forms | React Hook Form, Zod |
| Charts / maps | Recharts, Leaflet |
| Realtime | Socket.IO client |
| Push | Firebase (FCM), Web Push + service worker |
| Export | jsPDF, html2pdf, xlsx |
| Payments | Paystack inline JS (parent portal) |

### Backend (`/backend`)

| Layer | Technology |
|-------|------------|
| Server | Node.js, Express 5, TypeScript |
| Database | PostgreSQL |
| Auth | JWT, bcrypt |
| Realtime | Socket.IO (optional Redis adapter for scale) |
| Push | web-push (VAPID), Firebase Admin |
| Payments | Paystack API + webhooks |
| Files | Multer, Sharp |
| Jobs | node-cron, setInterval schedulers |
| Email | Nodemailer |

---

## Architecture

### Multi-tenancy

- **Shared database, shared schema** — every school row includes `tenant_id`
- Schools are reached by **subdomain** (e.g. `yourschool.scholarnerve.com`) or legacy paths (`/school/:id`, `/sch/:slug`)
- **Partners portal** on dedicated partners host · **School websites** on `schoolsite.*` host
- Backend middleware resolves the active tenant from headers or host
- **Super admin** operates at platform level; **school admin** operates inside one tenant

### Immutable student ledger (finance)

Financial records use an **append-only ledger** — balances are never stored as a single editable number:

- Debits (fees, arrears) and credits (payments, waivers) are separate rows
- Balance = sum(debits) − sum(credits), computed at read time
- Arrears and credits **carry forward** across terms automatically
- Manual overrides are **audited** and append-only
- **Scholarship/beneficiary discounts** reduce fees automatically
- **Overpayments** carry as credit balance

See also: `docs/FEES_README.md`, `backend/docs/FINANCE_REFACTOR.md`

### Active term & onboarding

- Most modules require an **active academic term** before editing
- **Setup progress gate** guides new schools through initial configuration
- **Closed-term read-only mode** lets staff browse historical terms without editing
- **End-of-year wizard** handles promotions and graduations

---

## Complete Feature List

Modules are registered in `src/components/Dashboard.tsx` and shown in the sidebar (`src/components/Sidebar.tsx`) based on role permissions.

---

### Core, Auth & Multi-Tenancy

| Feature | Description |
|---------|-------------|
| **JWT authentication** | Login, password change, session management |
| **Role-based access control (RBAC)** | Module permission keys gate sidebar items per role |
| **Primary vs additional admin** | Primary admin full access; additional admin gets academic/ops subset |
| **Multi-tenant isolation** | All data scoped by `tenant_id` |
| **Subdomain routing** | Each school on its own subdomain |
| **School self-registration** | Public `/register-school` → super-admin approval workflow |
| **Impersonation (“Become a User”)** | Admins view as another user; fully audited |
| **Account lockout** | Brute-force protection after failed login attempts |
| **Audit logging** | School-level and platform-level action history |
| **School backup / restore** | Tenant backup download/upload (admin + super-admin) |
| **Idempotency guard** | Prevents duplicate financial API writes |

---

### Public & Landing

| Feature | Description |
|---------|-------------|
| **Marketing landing page** | Public homepage with product showcase |
| **School selector** | Pick school when not on subdomain |
| **Public check-in page** | `/checkin` — student lookup by admission number |
| **ID card verification** | `/verify/:entityType/:entityId` — QR scan to verify card status |
| **404 / error pages** | Branded public error handling |
| **Platform admin obfuscation** | Super-admin at `/tn-7x4k2` with `noindex` |

---

### Dashboards & Overview

| Module | Description |
|--------|-------------|
| **Dashboard Home** | Enrollment snapshot, fees summary, personal todos, quick actions |
| **Administrator Dashboard** | School KPIs and activity for admins |
| **Financial Dashboard** | Revenue, collections, expenses (default for finance role) |
| **Teacher Dashboard** | Classes, salary summary, birthdays, staff clock, messages |
| **Headmaster Dashboard** | School oversight entry point with optional teaching access |
| **Personal todos** | Staff todo list with scheduled reminder notifications |
| **Finance realtime** | Socket.IO refreshes open finance dashboards on changes |

---

### Students & Enrollment

| Feature | Description |
|---------|-------------|
| **Student registry** | Full profiles, photos, admission numbers, class assignment |
| **Enrollment statuses** | Active, pending admission, inactive, graduated/alumni tabs |
| **Add student / pending admissions** | New intake workflow with pending queue |
| **Promotions** | Individual and bulk class promotion |
| **Alumni management** | Graduated students registry |
| **End-of-year wizard** | Full academic-cycle transition (promotion/graduation) |
| **Admission letters** | Generate and print admission letter PDFs; configurable template |
| **Beneficiary/scholarship discounts** | Fee discounts tied to student records |
| **Sibling linking** | Multi-child parent accounts |
| **View-only student access** | Headmaster/limited roles see roster without edit |
| **Student learning mode** | Online quiz access for assigned assessments |

---

### Teachers & Staff

| Feature | Description |
|---------|-------------|
| **Teachers module** | Profiles, subject/class assignments, active/suspended status |
| **Appointment letters** | Generate, view, download; configurable letter settings |
| **Teacher suspension job** | Cron enforces suspension rules automatically |
| **Other staff module** | Non-teaching staff register (drivers, admin staff, etc.) |
| **Staff field suggestions** | Autocomplete for common staff form fields |
| **All staff directory** | Headmaster read-only combined teachers + staff view |
| **Removed staff recovery** | Super-admin recover or permanently delete removed staff |
| **Teacher payment history** | Teachers view own salary payment records |
| **Teacher profile (self-service)** | Staff update own profile details |
| **Payroll** | Monthly payroll runs for teachers and staff |

---

### Classes, Subjects & Academic Structure

| Feature | Description |
|---------|-------------|
| **Classes module** | Create/edit classes, assign students, class levels |
| **Class levels** | Configurable grade/year levels |
| **Subjects module** | Subject catalogue and teacher-subject-class mapping |
| **Academic terms & years** | Term creation, activation, carry-forward |
| **Academic calendar** | School events and term dates |
| **Birthdays** | Upcoming student/staff birthday lists and widgets |
| **Class attendance** | Daily register: present/absent/late; history and exports |
| **Academic reports** | Class/subject performance reporting |
| **Records / document center** | Student financial/academic records, report card archive |
| **Grade configuration** | Grading scales, weights, report card rules |

---

### Grades, Assessments & Term Reports

| Feature | Description |
|---------|-------------|
| **Gradebook** | Score entry per subject/term; weighted assessments; BECE-style grading |
| **Assessment types** | Assignment, quiz, test, exam, practical, project with configurable weights |
| **Grade overrides** | Moderated mark changes with audit trail |
| **Term report / class position** | Term report cards and ranking; parent portal “Position” tab |
| **Online assessments (teacher quizzes)** | MCQ/true-false quiz bank; assign to classes; review submissions |
| **Student quiz taking** | Via staff portal or parent Learning Mode |
| **Export** | Gradebook CSV/XLSX export; report card print/PDF |

See: `docs/GRADES_EXAMS_TERM_REPORT_IT.md`

---

### Timetable

Full weekly scheduling for classes, exams, and teachers.

| Feature | Description |
|---------|-------------|
| **Class timetable builder** | Mon–Fri grid: days as rows, time columns across the top |
| **Per-class time columns** | Each class + term has its own columns, times, and break settings (independent schedules) |
| **Auto-start grid** | Selecting class + term creates 6 default columns automatically |
| **Add / delete columns** | Add unlimited time slots; delete columns (minimum 1 kept) |
| **Break periods** | Mark any column as break — spans all days, no lessons allowed |
| **Subject-first assignment** | When filling a cell: pick **subject first**, then teacher (filtered by class assignments) |
| **Teacher conflict detection** | Warns if a teacher is double-booked at overlapping times |
| **Exam timetable** | Separate exam schedule with date, time, venue, and notes |
| **Teacher “My schedule”** | Teachers see only their assigned periods and lessons for the term |
| **Up next today** | Teacher view shows next upcoming class with countdown |
| **Class-start notifications** | Cron job notifies teachers **5 minutes before** each class (in-app bell + browser push) |
| **School overview** | Admin read-only view of any class timetable |
| **Print** | Print class timetable with school logo |
| **Dark mode** | Full dark theme support across timetable UI |

**UI:** `src/components/timetable/` · **API:** `backend/src/routes/timetable.ts` · **Job:** `backend/src/jobs/classPeriodReminderJob.ts`

---

### Attendance & Check-in

Two related but separate systems:

#### Class attendance (teachers)

- Teachers mark **daily class registers** by date
- History and exports for patterns over time
- Headmaster can view **all classes** read-only

#### Campus check-in (students)

| Feature | Description |
|---------|-------------|
| **Check-in dashboard** | On-campus vs off-campus; filter by class; export |
| **Staff check-in panel** | Assist drop-off/pick-up from class roster |
| **Check-in settings** | Generate morning/afternoon QR PDFs per student |
| **Public check-in page** | `/checkin` — lookup by admission number, no login |
| **Parent check-in** | Parents check children in/out from portal |

#### Staff attendance (“Staff Clock”)

| Feature | Description |
|---------|-------------|
| **Clock in / out** | GPS geofence validation |
| **Admin dashboard** | Today’s staff, history, manual corrections, late detection |
| **Staff clock settings** | School start time, late threshold, geofence radius |
| **Auto-checkout cron** | End-of-day automatic staff checkout at 18:00 (Africa/Accra) |
| **Check-in reminder push** | Reminds staff who haven’t clocked in 1 hour after school start |

---

### Messaging & Communication

#### Internal staff chat

| Feature | Details |
|---------|---------|
| **Channels** | General, Teachers, Non-teaching, Announcements, Direct messages |
| **Messages** | Text + photo attachments |
| **Realtime** | Dedicated Socket.IO `/chat` namespace |
| **Extras** | Typing indicators, read state, mute channel, online count, soft-delete |

#### Parent Desk

- Parents send typed messages from portal (absence, fees, academic, etc.)
- Admins reply in threaded conversations with photo attachments
- Unread badges in sidebar; realtime socket updates

#### Other communication

| Feature | Description |
|---------|-------------|
| **Push notification broadcasts** | Target all parents, teachers, or groups via Web Push + FCM |
| **ScholarNerve support chat** | School staff ↔ platform super-admin support |
| **Global/school announcements** | Popup announcements; scheduled delivery cron |
| **Messages unread badges** | Sidebar + PWA app badge sync |

---

### Financial Operations & Paystack

| Module | Description |
|--------|-------------|
| **Fee structures** | Per-class term fees; line-item fee structures |
| **Student ledger (append-only)** | Debits/credits; live balance at read time; arrears carry-forward |
| **Fee collection & receipts** | Record payments; printable receipts with frozen snapshot |
| **Receipt corrections & locking** | Audited corrections; cron locks old receipts |
| **Daily fees** | Non-term daily fee structures and collection |
| **Invoices** | Create/send invoices; PDF; overdue status cron |
| **Finance statement** | Per-student statement view/print |
| **Income & expenses** | Non-fee income and operating expenses |
| **Term budget** | Budget planning per term |
| **Transactions ledger** | Full transaction history view |
| **Cash & bank accounts** | Multiple accounts; transfers |
| **Payment submissions** | Parents upload payment proofs; admin review queue |
| **Paystack online payments** | School-level Paystack config (test/live keys) |
| **Parent Paystack checkout** | Parents pay fees online from portal via Paystack inline JS |
| **Paystack webhooks** | Server-side payment verification and ledger credit |
| **Platform Paystack controls** | Super-admin enables/configures Paystack per tenant |
| **Manual balance overrides** | Audited append-only adjustments |
| **Print fee status** | Class fee status printouts/PDF |
| **Advanced finance reports** | Revenue, collections, operations analytics |
| **Payment accounts config** | MoMo/bank accounts shown to parents |
| **Payroll** | Monthly payroll runs for teachers and staff |
| **Scholarship/beneficiary discounts** | Automatic fee reductions |
| **Credit balance (overpayment)** | Overpayments carried as credit |

See: `docs/FEES_README.md`

---

### Transport

| Module | Description |
|--------|-------------|
| **Overview** | Fleet summary dashboard |
| **Live Map** | Leaflet map of routes/vehicles |
| **Routes** | Route builder and management |
| **Vehicles** | Vehicle registry |
| **Drivers** | Driver assignments |
| **Student transport assignments** | Assign students to routes |

---

### Parent Portal (PWA)

Route: **`/portal`** on school subdomain (or legacy `/portal/:tenantId`)

| Tab / area | What parents can do |
|------------|---------------------|
| **Overview** | Dashboard, notifications, birthdays, admission letters, continue learning |
| **Grades** | View subject grades |
| **Position** | Term report / class ranking |
| **Finance** | Balance, term bill, statements, invoices |
| **Make payment** | Upload payment proof **or** Paystack online checkout when enabled |
| **Attendance** | View attendance history |
| **Parent Desk** | Message school (text + photo) |
| **Check-in** | QR scan / manual student check-in |
| **Learning Mode** | Take teacher-assigned online quizzes; leaderboard |

Also supports: multi-child accounts, sibling linking, push notifications (FCM + Web Push), receipt printing, password change, and PWA install on home screen.

**Main file:** `src/pages/ParentPortal.tsx` · **API:** `backend/src/routes/parent.ts`, `parentOnlinePayments.ts`

---

### School Public Website

Each school can publish a branded public website on a dedicated host.

| Feature | Description |
|---------|-------------|
| **Public pages** | Home, About, Management team, Admissions, Events, Gallery, Careers, Alumni, Contact |
| **Online applications** | Admission application form with open/closed windows |
| **Employment applications** | Careers/job applications |
| **Contact form** | Inbound messages to school admin |
| **Alumni profiles** | Public alumni showcase |
| **Website CMS (admin)** | Full content management inside staff portal |
| **Super-admin oversight** | Platform panel for all school websites |

**UI:** `src/pages/school-website/`, `src/components/website/` · **API:** `schoolWebsite.ts`, `publicSchoolWebsite.ts`

---

### Partners Program

Dedicated partners subdomain for the ScholarNerve referral program.

| Feature | Description |
|---------|-------------|
| **Partner registration wizard** | Multi-step signup (profile, region, MoMo, goals, account) |
| **Partner login / password reset** | Email/phone auth with forgot/reset flow |
| **Partner dashboard** | Home overview, referral tools, tier/status |
| **Refer schools** | Submit school leads through dashboard |
| **My schools / leads** | Track referred schools and pipeline |
| **Commissions / earnings** | Commission history and MoMo payout details |
| **Partner training academy** | Training videos with watch tracking |
| **Partner support chat** | In-app support messaging |
| **Partner profile & ID card** | Profile management; partner ID card showcase |
| **Push notifications** | Web Push + FCM for partner portal |
| **Super-admin partners panel** | Approve/suspend partners, manage program |
| **School admin partners view** | School-side partner visibility |

**UI:** `src/pages/partners/` · **API:** `partners.ts`, `adminPartners.ts`

---

### Platform Super Admin

Accessed at **`/tn-7x4k2`** (obfuscated URL; not indexed by search engines).

| Area | Capabilities |
|------|--------------|
| **Schools** | Create, edit, activate/deactivate, archive, enter school view, branding |
| **Registration requests** | Approve/reject `/register-school` submissions |
| **Usage & analytics** | Platform usage stats |
| **Visitor analytics** | Landing page visit tracking |
| **Online users** | Live sessions across platform |
| **Tracker** | Per-school user activity/security timeline |
| **School data / backup** | Tenant backup download/upload |
| **Support chat** | All-school support inbox |
| **School general chat oversight** | Monitor school general channels + broadcast |
| **School websites** | Platform-wide website management |
| **Partners** | Partner program administration |
| **Paystack platform controls** | Enable/configure online payments per tenant |
| **Global announcements** | Platform-wide announcement popups |
| **Platform settings** | Global UI/config |
| **Finance config (danger zone)** | Term finance wipe / force-close tools |
| **Removed staff** | Recover or permanently delete |
| **System health** | Service monitoring |
| **Super admins** | Manage platform admin accounts |
| **Audit logs** | Platform-wide audit with filters |
| **Become a user / impersonation** | Enter any school as any user |

School self-registration: **`/register-school`**

---

### ID Cards & Verification

| Feature | Description |
|---------|-------------|
| **ID card generation** | Student and staff ID cards |
| **Bulk print cards** | Mass ID card printing |
| **Lost cards** | Report and track lost cards |
| **ID card color settings** | Card branding colours |
| **Public card verification** | QR scan opens verification page (verified/revoked/inactive) |

---

### Innovation, Settings & System Tools

| Module | Description |
|--------|-------------|
| **AI Assistant** | In-app helper for admins with finance/student context |
| **Users module** | Staff accounts and role/permission assignment |
| **Parent accounts** | Manage parent portal logins and ward linking |
| **Settings — school identity** | Name, logo, colours, contact, WhatsApp, office hours |
| **Settings — academic terms** | Term manager with activation modal |
| **Settings — fees** | Fee structure configuration |
| **Settings — payment details** | Payment instructions for parents |
| **Settings — headmaster signature/stamp** | Letter and report card signatures |
| **Appointment letter settings** | Template configuration |
| **Admission letter settings** | Template configuration |
| **Student QR check-in settings** | QR PDF generation config |
| **Staff clock settings** | Geofence, times, thresholds |
| **School backup** | Download tenant backup (admin) |
| **Audit logs (school)** | School-level action history |
| **Complaints (admin)** | Staff/parent complaint triage dashboard |
| **My complaints (staff)** | File and track personal complaints |
| **Impersonation** | Admins can “become” a user for support (audited) |

---

## Real-Time & Notifications

| System | Used for |
|--------|----------|
| **Socket.IO (main)** | Finance invalidation, parent desk, support chat, presence, tenant events, staff notifications |
| **Socket.IO (`/chat`)** | Staff internal chat — messages, typing, deletes, read receipts |
| **Web Push (VAPID)** | Browser push for staff, parents, and partners |
| **Firebase FCM** | Mobile web push (especially parent portal on Android/iOS) |
| **Native Badge API** | Unread count on installed PWA icon |
| **Teacher notification bell** | In-app toasts + browser notifications for salary, admin, chat, complaints, timetable reminders |
| **Parent notifications** | Payment success, quiz alerts, debt reminders, server-synced bell panel |

Service worker: `public/sw.js` handles caching, offline shell, and push click actions.

---

## Background Jobs (Cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| **Receipt lock** | Daily | Lock old receipts against further edits |
| **Invoice status** | Daily | Update overdue invoice states |
| **Teacher suspension** | Daily | Re-enable expired teacher suspensions |
| **Todo reminders** | Every 15s | Staff personal todo notifications |
| **Scheduled announcements** | Every 30s | Deliver timed announcement popups |
| **Staff auto-checkout** | Daily 18:00 (Africa/Accra) | Force checkout open staff sessions |
| **Staff check-in reminder** | Per-tenant cron | Push staff who haven’t clocked in 1h after school start |
| **Class period reminders** | Every 60s | Notify teachers 5 minutes before each scheduled class |

Jobs live in `backend/src/jobs/` and start from `backend/src/index.ts`.

---

## Progressive Web App (PWA)

ScholarNerve is designed to install like a native app:

- **Dynamic manifest** per school (name, colours, logo from API)
- **Dynamic icons** generated from school logo
- **Offline-friendly** app shell with branded splash screen
- **Separate PWA kinds**: school staff app, parent portal, platform admin, partners portal
- **Inactivity logout** skipped when running as installed PWA (standalone mode)
- **Background service worker updates** without disrupting active sessions

Key files: `index.html`, `public/sw.js`, `backend/src/routes/pwa.ts`, `src/utils/pwaBranding.ts`

---

## Security & Roles

### Roles

`super-admin` · `administrator` · `finance` · `headmaster` · `teacher` · `staff` · `driver` · parent (separate auth) · partner (separate auth)

### Permission model

- **Module-based RBAC** — each sidebar item maps to a permission key
- **Primary admin** — full school access
- **Additional administrator** — academic/ops subset
- **Finance** — financial modules + read-only people data
- **Teacher/staff** — teaching room + limited system modules
- **Super-admin** — platform tools; inside a school view behaves like primary admin

### Security features

- JWT authentication with tenant context
- Account lockout after failed login attempts
- Full **audit logging** of sensitive actions
- Platform admin route: **`noindex, nofollow`** + `robots.txt` disallow
- Impersonation sessions are tracked and reversible
- Paystack webhook signature verification

---

## Project Structure

```
school-management-system/
├── backend/
│   ├── db/migrations/       # SQL migrations (timetable, paystack, partners, …)
│   ├── src/
│   │   ├── db/              # PostgreSQL pool, schema, ensureSchema
│   │   ├── middleware/      # Auth, tenant, audit, CORS, term guards
│   │   ├── routes/          # REST API (76 route modules)
│   │   ├── socket/          # Socket.IO + chat socket
│   │   ├── services/        # Business logic
│   │   ├── jobs/            # Cron and interval jobs
│   │   └── index.ts         # API entry point
│   └── uploads/             # Uploaded files (logos, etc.)
├── docs/
│   ├── FEES_README.md
│   └── GRADES_EXAMS_TERM_REPORT_IT.md
├── src/
│   ├── components/          # UI modules (chat, fees, timetable, checkins, …)
│   ├── contexts/            # Auth, School, Socket, ChatSocket, Data, …
│   ├── pages/               # Landing, ParentPortal, SuperAdmin, partners, …
│   ├── services/            # API client wrappers
│   ├── hooks/               # useFinanceRealtime, useChatSocket, useStaffPushSync, …
│   └── utils/               # Tenant host, PWA, impersonation helpers
├── public/
│   └── sw.js                # Service worker
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **PostgreSQL 12+**

### 1. Database

```bash
createdb sms_db
# or
psql -U postgres -c "CREATE DATABASE sms_db;"
```

Optional schema script: `backend/create-db.sql`

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sms_db
JWT_SECRET=use-a-strong-secret-at-least-32-chars-long
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Push notifications (optional but recommended)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@yourschool.com

# Paystack (optional — for online parent payments)
# Configured per-tenant in admin UI; platform keys in super-admin
```

```bash
npm run dev
```

Tables are created/updated automatically on first boot via `ensureSchema.ts` and migrations.

### 3. Frontend

```bash
cd ..
npm install
npm run dev
```

App runs at **http://localhost:8080** (Vite proxies `/api`, `/uploads`, and `/socket.io` to port 3001).

### 4. First login

1. Open the app in your browser.
2. Go to the platform admin URL: **`/tn-7x4k2`**
3. Default super admin (change immediately in production):
   - **Username:** `superadmin`
   - **Password:** `superadmin123`
4. Register a school, create a school administrator, then set up academic terms and classes.

---

## Production Notes

### Checklist

1. Set a strong **`JWT_SECRET`** and **`DATABASE_URL`** with SSL for cloud Postgres.
2. Serve frontend over **HTTPS** (required for PWA install and push).
3. Lock **CORS** to your production domain in `backend/src/index.ts`.
4. Set **`VITE_API_BASE_URL`** at build time if API is on a different host.
5. Configure **Web Push VAPID** keys and **Firebase** credentials for notifications.
6. Configure **Paystack** live keys per school (super-admin enables per tenant).
7. Optional: **`REDIS_URL`** for multi-server Socket.IO chat scaling.
8. Run backend with a process manager (e.g. PM2): `npm run build && pm2 start dist/index.js`

### Build frontend

```bash
npm run build
```

Output in `dist/` — serve with nginx or similar; ensure `/api` and `/uploads` proxy to the backend.

### Troubleshooting

| Issue | Check |
|-------|--------|
| Database connection failed | `pg_isready`, verify `DATABASE_URL` |
| API unreachable from frontend | Vite proxy in dev; nginx `/api` proxy in prod |
| Push not working | HTTPS, VAPID keys, service worker registered |
| Chat not realtime | Socket.IO connection, `REDIS_URL` if multi-server |
| Paystack payments failing | Webhook URL reachable, keys match test/live mode |
| Teacher schedule 400 error | Restart backend after timetable SQL fixes |

---

## Additional Documentation

| Document | Contents |
|----------|----------|
| `docs/FEES_README.md` | Student ledger, fee structures, receipts, arrears |
| `docs/GRADES_EXAMS_TERM_REPORT_IT.md` | Gradebook, assessments, term reports |
| `backend/docs/FINANCE_REFACTOR.md` | Finance architecture notes |
| `backend/README.md` | Backend API overview |

---

## License

Private / proprietary — Rosa Gardens / ScholarNerve.

---

**ScholarNerve** — run your school smarter.
