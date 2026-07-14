# ScholarNerve — School Management System

**ScholarNerve** (also referenced in code as EDUNERVE / Rosa Gardens) is a full-stack, multi-tenant school management platform for JHS and primary schools. It covers academics, finance, attendance, payroll, parent communication, internal messaging, and mobile-friendly PWA portals — all in one system with strict data isolation per school.

---

## Table of Contents

- [What This System Does](#what-this-system-does)
- [Who Uses It](#who-uses-it)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features by Area](#features-by-area)
  - [Dashboards & Overview](#dashboards--overview)
  - [Academic Central](#academic-central)
  - [Teaching Room](#teaching-room)
  - [Attendance & Check-in](#attendance--check-in)
  - [Messaging & Communication](#messaging--communication)
  - [Financial Operations](#financial-operations)
  - [Transport](#transport)
  - [Parent Portal (PWA)](#parent-portal-pwa)
  - [Platform Super Admin](#platform-super-admin)
  - [Innovation & System Tools](#innovation--system-tools)
- [Real-Time & Notifications](#real-time--notifications)
- [Progressive Web App (PWA)](#progressive-web-app-pwa)
- [Security & Roles](#security--roles)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Production Notes](#production-notes)

---

## What This System Does

ScholarNerve helps schools run day-to-day operations digitally:

- Register and manage **students, teachers, and staff**
- Mark **class attendance** and track **campus check-in/out** (QR-based)
- Record **grades**, build **report cards**, and run **online quizzes**
- Collect **fees**, issue **receipts**, manage **invoices**, and run **payroll**
- Communicate with **parents** (Parent Desk), **staff** (internal chat), and **platform support**
- Send **push notifications** to parents and staff
- Give each school its own **subdomain**, branding, and isolated data

Everything is built around **multi-tenancy**: many schools share one application, but each school’s data is separated by `tenant_id`.

---

## Who Uses It

| User | Portal | Main capabilities |
|------|--------|-------------------|
| **Platform super admin** | Obfuscated admin URL (`/tn-7x4k2`) | Manage all schools, registrations, support, audits, backups |
| **School administrator** | School subdomain or `/school/:id` | Full school setup, users, finance, reports |
| **Finance team** | Same as admin (finance modules) | Fees, ledger, payroll, payment proofs, budgets |
| **Headmaster** | School portal + oversight views | School-wide read-only views + optional teaching |
| **Teacher / staff** | School portal | Classes, attendance, grades, quizzes, staff clock, chat |
| **Driver / other staff** | School portal | Staff clock, messages, limited modules |
| **Parents** | Parent PWA (`/portal`) | Grades, fees, attendance, pay, message school, check-in |

---

## Tech Stack

### Frontend (`/`)

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Vite 5 |
| Components | Radix UI, shadcn-style components, Tailwind CSS |
| Routing | React Router DOM 6 |
| Data | TanStack React Query, React Context |
| Forms | React Hook Form, Zod |
| Charts / maps | Recharts, Leaflet |
| Realtime | Socket.IO client |
| Push | Firebase (FCM), Web Push + service worker |
| Export | jsPDF, html2pdf, xlsx |

### Backend (`/backend`)

| Layer | Technology |
|-------|------------|
| Server | Node.js, Express 5, TypeScript |
| Database | PostgreSQL |
| Auth | JWT, bcrypt |
| Realtime | Socket.IO (optional Redis adapter for scale) |
| Push | web-push (VAPID), Firebase Admin |
| Files | Multer, Sharp |
| Jobs | node-cron |
| Email | Nodemailer |

---

## Architecture

### Multi-tenancy

- **Shared database, shared schema** — every school row includes `tenant_id`
- Schools are reached by **subdomain** (e.g. `yourschool.scholarnerve.com`) or legacy paths (`/school/:id`, `/sch/:slug`)
- Backend middleware resolves the active tenant from headers or host
- **Super admin** operates at platform level; **school admin** operates inside one tenant

### Immutable student ledger (finance)

Financial records use an **append-only ledger** — balances are never stored as a single editable number:

- Debits (fees, arrears) and credits (payments, waivers) are separate rows
- Balance = sum(debits) − sum(credits), computed at read time
- Arrears and credits **carry forward** across terms automatically
- Manual overrides are **audited** and append-only

### Background jobs

Scheduled tasks include: receipt locking, invoice status updates, teacher suspension checks, todo reminders, scheduled announcements, and **staff auto-checkout** at end of day.

---

## Features by Area

Modules are registered in `src/components/Dashboard.tsx` and shown in the sidebar (`src/components/Sidebar.tsx`) based on role permissions.

### Dashboards & Overview

| Module | Description |
|--------|-------------|
| **Dashboard Home** | Enrollment, fees snapshot, quick actions, personal todos |
| **Administrator Dashboard** | School-level KPIs and activity |
| **Financial Dashboard** | Revenue, collections, expenses (finance role) |
| **Teacher Dashboard** | Classes, salary summary, birthdays, staff clock, messages |
| **Headmaster Dashboard** | School oversight entry point |

Onboarding helpers guide new schools: **active term setup**, **setup progress gate**, and **term read-only** mode when browsing closed terms.

---

### Academic Central

| Module | Description |
|--------|-------------|
| **Students** | Full profiles, photos, admission letters, promotions, view-only mode for limited roles |
| **Teachers** | Profiles, assignments, appointment letters, status (active/suspended) |
| **Other Staff** | Non-teaching staff register |
| **Classes & Subjects** | Class structure, subject catalogue, teacher mapping |
| **Calendar** | School events and term dates |
| **Birthdays** | Upcoming student/staff birthdays |
| **ID Cards** | Generate and bulk-print student/staff ID cards |
| **Lost Cards** | Report and track lost ID cards |
| **Academic Reports** | Class and subject performance reporting |
| **Records** | School document / records storage |
| **End of Year** | Promotion and graduation wizard |
| **Complaints** | Admin view of staff/parent complaints |

---

### Teaching Room

| Module | Description |
|--------|-------------|
| **My Classes** | Rosters for assigned classes |
| **Attendance** | Daily class register (present / absent / late) |
| **Grades** | Score entry, report card data, BECE-style grading |
| **Online Assessments** | Quiz bank (MCQ, true/false), assign to classes, review submissions |
| **Teacher Profile** | Self-service profile updates |
| **Appointment Letters** | View/download generated letters |
| **Payment History** | View own salary payments |
| **Student Check-in** | Staff-assisted campus check-in panel |
| **Staff Clock** | Personal clock-in/out history |
| **My Complaints** | File and track personal complaints |

**Headmaster** (when enabled) gets read-only school-wide views: all classes, all attendance, all staff, grades overview, fee status, complaints.

---

### Attendance & Check-in

Two related but separate systems:

#### Class attendance (teachers)

- Teachers mark **daily class registers** by date
- History and exports for patterns over time
- Headmaster can view **all classes** read-only

**Components:** `AttendanceModule.tsx` · **API:** `backend/src/routes/attendance.ts`

#### Campus check-in (students)

- **Check-in dashboard** — who is on campus vs off campus, filter by class, export
- **Staff check-in panel** — assist drop-off / pick-up from class roster
- **Check-in settings** — generate **morning drop-off** and **afternoon pick-up** QR PDFs per student
- **Public check-in page** (`/checkin`) — lookup by admission number (no login)
- **Parent portal** — parents can check children in/out from their phone

**Components:** `CheckinDashboard.tsx`, `StaffCheckinPanel.tsx`, `CheckinSettings.tsx`, `ParentCheckinPanel.tsx`, `PublicCheckinPage.tsx`  
**API:** `studentCheckins.ts`, `publicCheckins.ts`

#### Staff attendance (“Staff Clock”)

- Staff **clock in / clock out** with **GPS geofence** validation
- Admin dashboard: today’s staff, history, manual corrections, late detection
- Configurable **school start time** and **late threshold**
- **Auto-checkout** cron at end of day

**Components:** `StaffAttendanceDashboard.tsx`, `StaffAttendanceClockCard.tsx`, `StaffAttendanceSettings.tsx`  
**API:** `staffAttendance.ts`

---

### Messaging & Communication

#### Internal staff chat (`Messages`)

WhatsApp-style chat for school staff:

| Feature | Details |
|---------|---------|
| **Channels** | General, Teachers, Non-teaching, Announcements, Direct messages (DM) |
| **Messages** | Text + **photo** (stored as embedded images for reliability) |
| **Realtime** | Dedicated Socket.IO namespace (`/chat`) |
| **Extras** | Typing indicators, read state, mute channel, online member count |
| **Mobile** | Optimised layout; background sync every 3s when chat is open |
| **Delete** | Users can delete their own messages (soft delete) |

**Components:** `ChatModule.tsx`, `ChatMessageGroup.tsx`, `ChatSocketContext.tsx`  
**API:** `backend/src/routes/chat.ts`, `backend/src/socket/chatSocket.ts`

#### Parent Desk (admin inbox)

- Parents send typed messages from the portal (absence, fee query, academic concern, etc.)
- Admins reply in threaded conversations with **photo attachments**
- Filters by message type and status; unread badges in sidebar

**Components:** `ParentDeskAdminModule.tsx` · **API:** `backend/src/routes/messages.ts`

#### Push notification broadcasts

- Send alerts to **all parents**, **teachers**, or targeted groups
- Delivered via Web Push and FCM

**Component:** `PushNotificationsModule.tsx`

#### ScholarNerve support chat

- School staff ↔ platform super-admin support
- Realtime inbox with read persistence

**Components:** `SupportModule.tsx`, `SupportChatWindow.tsx` · **API:** `supportChat.ts`

#### Global announcements

- Platform-wide or school-level announcement popups
- Scheduled delivery via cron

---

### Financial Operations

| Module | Description |
|--------|-------------|
| **Fees** | Term fee structures, collections, receipts, arrears |
| **Daily Fees** | Non-term daily fee collection |
| **Invoices** | Create invoices, PDF download |
| **Finance Statement** | Per-student financial statement |
| **Income & Expenses** | Non-fee income and operating expenses |
| **Term Budget** | Budget planning per term |
| **Transactions** | Full transaction ledger view |
| **Payment Submissions** | Review parent-uploaded payment proofs |
| **Cash & Bank** | Cash/bank accounts and transfers |
| **Payroll** | Monthly payroll runs for teachers and staff |
| **Manual Adjustments** | Audited balance overrides |
| **Print Fee Status** | Class fee status printouts |
| **Advanced Reports** | Finance and operations reporting |
| **Payment Accounts** | Configure MoMo/bank accounts shown to parents |

Finance updates can **invalidate in real time** across open dashboards via Socket.IO (`useFinanceRealtime`).

---

### Transport

| Module | Description |
|--------|-------------|
| **Overview** | Fleet summary |
| **Live Map** | Leaflet map of routes/vehicles |
| **Routes, Vehicles, Drivers** | Full transport management |
| **Students** | Assign students to routes |

---

### Parent Portal (PWA)

Route: **`/portal`** on school subdomain (or legacy `/portal/:tenantId`)

| Tab / area | What parents can do |
|------------|---------------------|
| **Overview** | Dashboard, notifications, birthdays, admission letters |
| **Grades** | View subject grades |
| **Position** | Term report / class ranking |
| **Finance** | Balance, term bill, statements, invoices, **make payment** (with proof upload) |
| **Attendance** | View attendance history |
| **Parent Desk** | Message the school (text + photo) |
| **Check-in** | QR scan / manual student check-in |
| **Learning Mode** | Take teacher-assigned online quizzes |

Also supports: multi-child accounts, sibling linking, push notifications, receipt printing, password change, and PWA install on home screen.

**Main file:** `src/pages/ParentPortal.tsx` · **API:** `backend/src/routes/parent.ts`

---

### Platform Super Admin

Accessed at **`/tn-7x4k2`** (obfuscated URL; not indexed by search engines).

| Area | Capabilities |
|------|--------------|
| **Schools** | Create, manage, enter school view, backup/restore |
| **Registrations** | Approve/reject new school signup requests |
| **Usage & Analytics** | Platform usage stats, visitor analytics |
| **Online Users** | Live presence across platform |
| **Tracker** | Security / activity timeline per school user |
| **Support Chat** | All-school support inbox |
| **School Chat** | Oversight of school general channels + broadcast |
| **Announcements** | Global announcements to schools |
| **Platform Settings** | Global UI/config |
| **Finance Tools** | Term finance wipe / force-close (danger zone) |
| **Removed Staff** | Recover or permanently delete removed staff |
| **System Health** | Service health monitoring |
| **Super Admins** | Manage platform admin accounts |
| **Audit Logs** | Platform-wide audit trail |

School self-registration: **`/register-school`**

---

### Innovation & System Tools

| Module | Description |
|--------|-------------|
| **AI Assistant** | In-app helper for admins (balances, payments, receipts context) |
| **Users** | Staff user accounts and role assignment |
| **Parent Accounts** | Manage parent portal logins |
| **Settings** | School name, logo, terms, academic years, payment config |
| **Audit Logs** | School-level action history |
| **Grade Configuration** | Grading scales and report card rules |
| **Letter Settings** | Appointment and admission letter templates |
| **ID Card Settings** | Card colours and branding |
| **Impersonation** | Admins can “become” a user for support (audited) |

---

## Real-Time & Notifications

| System | Used for |
|--------|----------|
| **Socket.IO (main)** | Finance invalidation, parent desk updates, support chat, presence, tenant events |
| **Socket.IO (`/chat`)** | Staff internal chat — messages, typing, deletes, read receipts |
| **Web Push (VAPID)** | Browser push for staff and parents |
| **Firebase FCM** | Mobile web push (especially parent portal on Android/iOS) |
| **Native Badge API** | Unread count on installed PWA icon |

Service worker: `public/sw.js` handles caching, offline shell, and push click actions (opens chat without full page reload).

---

## Progressive Web App (PWA)

ScholarNerve is designed to install like a native app:

- **Dynamic manifest** per school (name, colours, logo from API)
- **Dynamic icons** generated from school logo
- **Offline-friendly** app shell with branded splash screen
- **Separate PWA “kinds”**: school staff app, parent portal, platform admin
- **Inactivity logout** skipped when running as installed PWA (standalone mode)
- **Background service worker updates** without disrupting active sessions

Key files: `index.html` (splash), `public/sw.js`, `backend/src/routes/pwa.ts`, `src/utils/pwaBranding.ts`

---

## Security & Roles

### Roles

`administrator` · `finance` · `headmaster` · `teacher` · `staff` · `driver` · `super-admin` · parent (separate auth)

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

---

## Project Structure

```
school-management-system/
├── backend/
│   ├── src/
│   │   ├── db/              # PostgreSQL pool, schema, migrations
│   │   ├── middleware/      # Auth, tenant, audit, CORS
│   │   ├── routes/          # REST API (students, fees, chat, attendance, …)
│   │   ├── socket/          # Socket.IO + chat socket
│   │   ├── services/        # Business logic
│   │   ├── jobs/            # Cron jobs
│   │   └── index.ts         # API entry point
│   └── uploads/             # Uploaded files (logos, etc.)
├── src/
│   ├── components/          # UI modules (chat, fees, teacher, checkins, …)
│   ├── contexts/            # Auth, School, Socket, ChatSocket, Data, …
│   ├── pages/               # Landing, ParentPortal, SuperAdmin, …
│   ├── services/            # API client wrappers
│   ├── hooks/               # useFinanceRealtime, useChatSocket, …
│   ├── utils/               # Tenant host, PWA, impersonation helpers
│   └── content/             # User guides, landing SEO data
├── public/
│   └── sw.js                # Service worker
├── index.html               # App shell + PWA bootstrap
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
```

```bash
npm run dev
```

Tables are created/updated automatically on first boot.

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
6. Optional: **`REDIS_URL`** for multi-server Socket.IO chat scaling.
7. Run backend with a process manager (e.g. PM2): `npm run build && pm2 start dist/index.js`

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

---

## License

Private / proprietary — Rosa Gardens / ScholarNerve.

---

**ScholarNerve** — run your school smarter.
