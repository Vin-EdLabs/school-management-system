# 🏫 Rosa Gardens School Management System (Edunerve)

A next-generation, enterprise-grade, multi-tenant school management system built on a secure, highly performant React/TypeScript frontend and an Express/PostgreSQL backend. Designed for complete tenant isolation, immutable financial bookkeeping, and standard PWA compliance.

---

## 📖 Table of Contents

- [Core Architecture & System Mechanics](#-core-architecture--system-mechanics)
  - [1. Multi-Tenancy & Tenant Isolation](#1-multi-tenancy--tenant-isolation)
  - [2. Immutable Ledger-Based Finance](#2-immutable-ledger-based-finance)
  - [3. Progressive Web App (PWA) & Push Notifications](#3-progressive-web-app-pwa--push-notifications)
  - [4. Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
- [✨ Key Features by Module](#-key-features-by-module)
  - [Overview & Admin Dashboards](#overview--admin-dashboards)
  - [Academic Central](#academic-central)
  - [Teaching Room & Grading Desk](#teaching-room--grading-desk)
  - [Financial Ops (Ledger-Backed)](#financial-ops-ledger-backed)
  - [Communication & Innovation](#communication--innovation)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Directory Structure](#-directory-structure)
- [🚀 Quick Start & Installation](#-quick-start--installation)
  - [Prerequisites](#prerequisites)
  - [1. Database Setup](#1-database-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Initial Logins & Setup](#4-initial-logins--setup)
- [🛡️ Security & Production Deployment](#️-security--production-deployment)
  - [Production Checklist](#production-checklist)
  - [Troubleshooting Guide](#troubleshooting-guide)

---

## 🏗️ Core Architecture & System Mechanics

### 1. Multi-Tenancy & Tenant Isolation
The system utilizes a **shared-database, shared-schema** multi-tenancy model:
- **Data Isolation**: Every tenant (school) is isolated using a unique `tenant_id` column present in all relevant tables.
- **Tenant Middleware**: The backend intercepts and resolves the active school via custom request headers (`x-tenant-id`) or subdomains, ensuring that users can only read/write data belonging to their specific tenant.
- **Super Admin Oversight**: A global system-wide Super Admin can manage all school accounts, register new tenants, create administrative accounts for each school, and audit tenant activities.

### 2. Immutable Ledger-Based Finance
To ensure absolute auditability and prevent financial discrepancies, the finance module operates under an **immutable student ledger** pattern:
* **Single Table Ledger (`student_ledger`)**: All fee invoices, arrears, waivers, adjustments, and payments are strictly appended as separate records (rows) in the ledger.
* **No Inline Balance Updates**: The system *never* stores a running balance or overwrites previous transaction records.
* **Dynamic Calculations**: A student's current balance is calculated in real-time by subtracting the sum of credits (payments/waivers) from the sum of debits (fees/arrears):
  ```sql
  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
  FROM student_ledger 
  WHERE tenant_id = $1 AND student_id = $2;
  ```
* **Status Resolution**: 
  - `Balance > 0`: Student has outstanding arrears (owing).
  - `Balance = 0`: Account is completely cleared.
  - `Balance < 0`: Student has a credit balance (overpayment).
* **Cross-Term Carryovers**: When switching academic terms or promoting classes, unpaid arrears are automatically posted as an `arrears` entry to the new term, and overpayments are carried forward as a credit entry, keeping the student's cumulative ledger clean and accurate.

### 3. Progressive Web App (PWA) & Push Notifications
Designed to perform like a native application (WebAPK) on both Android and iOS devices:
* **Same-Origin Manifest Proxy**: To prevent mobile browsers (like Chrome on Android) from displaying site branding on native shortcuts, the manifest is dynamically served via a relative same-origin route (`/manifest.json?slug=school-slug`), proxied through the Service Worker (`sw.js`) to the backend API. This guarantees a clean, standalone WebAPK generation.
* **Push Notifications & 4KB Rule**: Full support for real-time notifications via Web Push and Firebase Cloud Messaging (FCM). Payloads strictly adhere to the **4,096-byte limit** by excluding heavy Base64 image payloads and relying on absolute image URLs and PNG fallbacks for background tasks.
* **Native Badge API**: Displays unread notification counts on the app icon on compatible OS shells using the standard browser `navigator.setAppBadge()` API.

### 4. Role-Based Access Control (RBAC)
Granular, hierarchical access levels protect sensitive user data across the system:
- **Super Admin**: System-level administrative control (creating/deleting tenants, registering schools, accessing system logs).
- **School Administrator**: Tenant-level full control (managing teachers, classes, subjects, students, configurations).
- **Finance Team**: Dedicated access to billing, fee structures, payment receipts, payroll, ledger manual overrides, and financial reporting.
- **Teachers**: Access limited to assigned classes, student attendance logs, grading desk, assignments, online quizzes, and personal profile details.
- **Parents/Students (Portal)**: Self-service portal to view grades, check attendance histories, review outstanding fees, inspect payment ledger history, and make payments.

---

## ✨ Key Features by Module

### Overview & Admin Dashboards
- **Dashboard Home**: Interactive, high-level summary cards, quick access shortcuts, and general system announcements.
- **Administrator Dashboard**: School-level dashboards with enrollment metrics, teacher/staff counts, and student statistics.
- **Financial Dashboard**: Charts displaying total expected vs. collected revenue, operating cash flows, expenses, and outstanding debts.

### Academic Central
- **Students Management**: Advanced profiles with complete details (medical reports, contacts, documents), automatic arrears calculations, student promotions, and photo uploads.
- **Teachers Directory**: Tracks teacher details, qualifications, salary structure links, and class/subject assignments.
- **Classes & Subjects**: Manage classes (e.g., JHS 1, Grade 5) and map subjects, assign teachers, and batch-promote entire cohorts between terms.
- **Calendar & Scheduling**: Dynamic calendar highlighting academic terms, upcoming exams, fee deadlines, and holidays.

### Teaching Room & Grading Desk
- **Attendance Tracker**: Visual interfaces for teachers to log daily student attendance and export attendance patterns.
- **Grading Desk**: Automated grade calculations, assignments logging, and terminal report card generations.
- **Online Assessments (Quiz Builder)**: Create customized quizzes, deliver online exams, and automatically post graded responses back to student cards.

### Financial Ops (Ledger-Backed)
- **Fee Structures**: Configurable fee templates matching specific classes, academic years, and terms (e.g., tuition, PTA, computer labs).
- **Payment Processing**: Multi-method payments (cash, mobile money, check), automated receipts generation, and automatic credit/balance tracking.
- **Payroll System**: Manage employee basic salaries, handle custom deductions or allowances, and print standard payslips.
- **Transaction History**: Searchable transaction list displaying all ledger movements with filtering and details.
- **Fee Status (Print & Export)**: Generate bulk statements of accounts, outstanding fee structures, and export data directly to PDF or Excel spreadsheets.

### Communication & Innovation
- **Push Alerts Hub**: Send targeted alerts (to all parents, teachers, or specific classes) directly as push notifications.
- **Parent Desk**: Shared communication terminal for handling inquiries, support cases, and general updates with parents.
- **AI Assistant**: Interactive conversational assistant helper (`AiChatModule`) that uses school databases (within context limits) to assist admins in fetching insights or answering student/parent questions.
- **Audit Logging**: Secure, detailed logs tracking user actions, configuration modifications, security changes, and system access history.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 (Vite-powered development and bundler)
- **Programming Language**: TypeScript
- **Styling & Components**: Tailwind CSS, shadcn/ui components built on top of Radix UI primitives
- **State & Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router DOM v6 (supports apex and wildcard subdomain routing)
- **Analytics & Graphs**: Recharts
- **Networking**: Axios / Native fetch with Socket.io-client
- **Exports**: JSPDF & XLSX for exporting spreadsheets and PDF reports

### Backend
- **Framework**: Express.js (running on Node.js)
- **Runtime Compiler**: tsx (TypeScript execute)
- **Database**: PostgreSQL (Raw SQL queries with pool connections for high speed)
- **Real-Time events**: Socket.io server
- **Auth**: JSON Web Tokens (JWT) for session management

---

## 📁 Directory Structure

```
school-management-system/
├── backend/
│   ├── src/
│   │   ├── db/                 # Database credentials, pool setup, and sql schema tables
│   │   ├── middleware/         # Auth, error, tenant resolving, and cors check
│   │   ├── routes/             # REST endpoints (auth, students, finance, pwa, audit)
│   │   └── index.ts            # Entrypoint file for the API server
│   ├── uploads/                # Local directory for uploaded school logos and files
│   ├── package.json            # Backend dependencies and startup scripts
│   └── start-server.js         # Fallback starter script
├── src/
│   ├── components/             # Reusable UI parts
│   │   ├── ai/                 # AI Assistant components
│   │   ├── classes/            # Class management views
│   │   ├── fees/               # Fee structures & billing forms
│   │   ├── finance/            # Ledger entries & balance override pages
│   │   ├── students/           # Student profile & CRUD components
│   │   ├── ui/                 # shadcn base UI primitives
│   │   └── ...                 
│   ├── contexts/               # Global React contexts (Auth, School, Socket, Data, ActiveTerm, Theme)
│   ├── pages/                  # Route level page layouts (SuperAdmin, ParentPortal, SchoolSelector)
│   ├── services/               # API endpoints wrapper client
│   ├── utils/                  # Helper utilities (subdomain detection, token parser)
│   ├── App.tsx                 # Routes layout and Context Providers wrap
│   └── main.tsx                # App entry mounting and SW registers
├── public/                     
│   └── sw.js                   # Service worker intercepting requests and managing push notices
├── package.json                # Frontend package configurations
└── vite.config.ts              # Vite configurations
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js version 18+ installed on your system.
- PostgreSQL database engine 12+ running locally or in a remote environment.

### 1. Database Setup
Create a blank database inside your PostgreSQL cluster:
```bash
# Using PostgreSQL CLI
createdb sms_db

# Or login into psql shell
psql -U postgres
CREATE DATABASE sms_db;
\q
```
Alternatively, feed the schema structure script:
```bash
psql -U postgres -f backend/create-db.sql
```

### 2. Backend Setup
1. Move to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install the node packages:
   ```bash
   npm install
   ```
3. Set up the environment variables. Copy the `.env.example` contents to a new `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sms_db
   JWT_SECRET=use-a-strong-secret-key-at-least-32-chars-long
   PORT=3001
   NODE_ENV=development
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=5242880
   ```
4. Fire up the backend api server:
   ```bash
   npm run dev
   ```
   *Note: On the first boot, the server will scan database models and run migrations automatically to create all necessary tables.*

### 3. Frontend Setup
1. Go back to the repository root:
   ```bash
   cd ..
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Boot the development dev server:
   ```bash
   npm run dev
   ```
   The client application will boot on `http://localhost:8080` (or another available port).

### 4. Initial Logins & Setup
1. Navigate to the application URL in your browser.
2. Sign in using the default Super Admin credential:
   - **Username**: `superadmin`
   - **Password**: `superadmin123`
   - **Role**: Super Admin
3. **Important**: Change this default password in your settings dashboard immediately!
4. Register your first school/tenant. This will configure the isolated workspace.
5. Create a school administrator account under that school to start registering students, classes, and terms.

---

## 🛡️ Security & Production Deployment

### Production Checklist
1. **Database SSL**: Ensure `ssl=true` is set on your `DATABASE_URL` for secure cloud database links.
2. **JWT Secret Strength**: Generate a secure, cryptographically random key for your production `JWT_SECRET`.
3. **CORS Restrictions**: Lock down CORS configurations to your official frontend domain inside `backend/src/index.ts`.
4. **Standalone App Generation**: Serve the frontend over HTTPS to enable WebAPK generation on Android/iOS devices.
5. **Daemon Management**: Run the backend using process managers like PM2 to keep the server alive under load:
   ```bash
   pm2 start dist/index.js --name school-management-api
   ```

### Troubleshooting Guide

#### Backend Database Failures
- Run `pg_isready` to make sure your database process is running.
- Ensure your database name matches the one configured in the `.env` connection string.

#### Port Conflicts
- If port `3001` or `8080` is in use, modify the `PORT` key inside your `.env` configuration file or edit `vite.config.ts`.

#### CORS / API Connection Refused
- Confirm your frontend and backend configurations. The backend expects requests to have appropriate CORS headers.
- Inspect the API URL configuration inside the client's `src/services/api.ts` file.
