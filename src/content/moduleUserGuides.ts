/**
 * In-app user guides keyed by the same `activeModule` ids used in Dashboard / Sidebar.
 * Shown from the header “User guide” button on every staff screen.
 */

export type ModuleUserGuide = {
  /** Short label shown in the dialog header */
  title: string;
  /** One line under the title */
  tagline: string;
  /** What this area of the system is for */
  purpose: string;
  /** Practical steps (shown as a numbered list) */
  steps: string[];
  /** Optional extra hints */
  tips?: string[];
};

function humanizeModuleId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const DEFAULT_GUIDE = (moduleId: string): ModuleUserGuide => ({
  title: humanizeModuleId(moduleId),
  tagline: 'Quick orientation for this screen',
  purpose:
    'This section is part of your school workspace. Use the controls, tables, and forms on the page to complete day-to-day tasks. Your role determines which actions you can perform.',
  steps: [
    'Read labels and section headings on the page—they match how your school configured the system.',
    'Use any search or filters at the top of lists to find a specific person, class, or record.',
    'Save or confirm only after reviewing amounts, dates, and names.',
    'If something looks wrong, do not guess—use Support Chat so ScholarNerve can help trace it.',
  ],
  tips: ['Use the sidebar to switch modules; your place is remembered while you work.'],
});

export const MODULE_USER_GUIDES: Record<string, ModuleUserGuide> = {
  dashboard: {
    title: 'Dashboard',
    tagline: 'Overview and quick actions',
    purpose:
      'The dashboard summarizes enrolment, fees, and activity for administrators. It helps you see what needs attention at a glance.',
    steps: [
      'Scan summary cards for totals (students, staff, collections, outstanding fees).',
      'Open list sections (e.g. students owing fees) to jump toward the right module.',
      'Use the sidebar to drill into Students, Fees, or Reports when you need detail.',
    ],
    tips: ['Figures respect the current academic term from Settings where applicable.'],
  },
  'financial-dashboard': {
    title: 'Financial dashboard',
    tagline: 'Finance-focused overview',
    purpose:
      'Built for finance staff: income, expenses, fee collection, and payroll-related visibility in one place.',
    steps: [
      'Review the metrics that matter for your reporting period.',
      'Follow links or the sidebar to Fees, Income, Expenses, Payroll, or Reports.',
      'Reconcile unusual numbers against ledger and payment records before adjusting balances.',
    ],
    tips: ['Balance overrides live under Financial → Balance overrides—not on the student list.'],
  },
  'teacher-dashboard': {
    title: 'My dashboard',
    tagline: 'Teacher home',
    purpose:
      'Your personal landing page: classes, attendance, grades, and notices relevant to you.',
    steps: [
      'Check announcements or shortcuts your school enabled.',
      'Open My Classes, Attendance, or Grades from the sidebar when you need to work with learners.',
      'Use Notifications (bell) if your school uses them.',
    ],
  },
  students: {
    title: 'Students',
    tagline: 'Register and manage learners',
    purpose:
      'Maintain the student register: admission data, class assignment, guardians, and enrolment status.',
    steps: [
      'Search or filter the list to find a student.',
      'Use row actions to view profile, edit, or promote where your role allows.',
      'Add new students with complete guardian contact details for SMS and portal access.',
    ],
    tips: ['Finance corrections use Balance overrides; student list is not for ledger overrides.'],
  },
  teachers: {
    title: 'Teachers',
    tagline: 'Staff register',
    purpose:
      'Manage teaching and other staff: profiles, assignments, and identifiers used across the system.',
    steps: [
      'Filter or search by name or staff ID.',
      'Edit a profile to update contact info, subjects, or class assignment.',
      'Coordinate with Settings if academic structure changes.',
    ],
  },
  classes: {
    title: 'Classes',
    tagline: 'Structure and cohorts',
    purpose:
      'Define classes (levels, streams) so students and fees attach to the correct cohort.',
    steps: [
      'Review existing classes before the new academic year.',
      'Create or edit class names to match your school’s naming.',
      'Assign teachers and capacities where your workflow requires it.',
    ],
  },
  subjects: {
    title: 'Subjects',
    tagline: 'Curriculum catalogue',
    purpose:
      'Maintain the list of subjects taught—used with timetables, grades, and reporting where configured.',
    steps: [
      'Add or edit subject names and codes consistently.',
      'Link subjects to classes or teachers per your school’s process.',
      'Avoid deleting subjects that are still referenced in historical grades.',
    ],
  },
  calendar: {
    title: 'Calendar',
    tagline: 'School events',
    purpose:
      'View and manage school events and important dates visible to staff (and parents where shared).',
    steps: [
      'Switch views if your calendar supports month/week/list.',
      'Create events with clear titles, times, and locations.',
      'Edit or cancel events when plans change.',
    ],
  },
  'teacher-classes': {
    title: 'My classes',
    tagline: 'Classes you teach',
    purpose:
      'See the classes assigned to you and open rosters or related teaching tools.',
    steps: [
      'Select a class to see enrolled students.',
      'Jump to attendance or grades for that class if shortcuts exist.',
      'Contact administration if a class is missing or wrong.',
    ],
  },
  attendance: {
    title: 'Attendance',
    tagline: 'Mark presence',
    purpose:
      'Record who was present or absent for lessons or roll call, for reporting and parent visibility.',
    steps: [
      'Pick the class and date for the session you are marking.',
      'Mark each student present, absent, or late according to your school rules.',
      'Save the register before leaving the page.',
    ],
    tips: ['If a student is not on the list, ask the office to confirm class assignment.'],
  },
  grades: {
    title: 'Grades',
    tagline: 'Assessment scores',
    purpose:
      'Enter or update scores and remarks so reports and transcripts stay accurate.',
    steps: [
      'Choose class, subject, and assessment period as prompted.',
      'Enter marks following the scale your school uses.',
      'Save and review totals before publishing or sharing.',
    ],
  },
  'teacher-quizzes': {
    title: 'Online assessments',
    tagline: 'Quizzes and learning checks',
    purpose:
      'Create and manage online quizzes for students where this feature is enabled.',
    steps: [
      'Create a quiz with clear instructions and time limits if needed.',
      'Assign to the right class or group.',
      'Review submissions and scores from this module.',
    ],
  },
  'teacher-profile': {
    title: 'My profile',
    tagline: 'Your staff record',
    purpose:
      'Update your own contact details and view information the school holds about you.',
    steps: [
      'Review each section for accuracy.',
      'Save changes after editing phone, email, or emergency contacts.',
      'Request HR or admin updates for fields you cannot edit yourself.',
    ],
  },
  'teacher-payment-history': {
    title: 'Payment history',
    tagline: 'Your salary payments',
    purpose:
      'See past payroll payments credited to you for transparency.',
    steps: [
      'Scroll or filter by period if available.',
      'Open a row or receipt link if your school attaches documents.',
      'For disputes, use Support Chat with dates and amounts.',
    ],
  },
  fees: {
    title: 'Fees',
    tagline: 'Billing and collections',
    purpose:
      'Set fee structures, record payments, print receipts, and monitor balances for the current term.',
    steps: [
      'Confirm the active term in Settings matches what you are billing.',
      'Use Record payment with the correct student and amount.',
      'Use class or student balance views to follow up on arrears.',
    ],
    tips: ['Carry-forward arrears may use dedicated finance actions—follow your school’s process.'],
  },
  income: {
    title: 'Income',
    tagline: 'Non-fee revenue',
    purpose:
      'Log other income (donations, rentals, services) separate from student fee payments.',
    steps: [
      'Add an entry with date, category, and amount.',
      'Attach notes or references for audit.',
      'Reconcile periodically with bank or cash records.',
    ],
  },
  expenses: {
    title: 'Expenses',
    tagline: 'Outgoing payments',
    purpose:
      'Track what the school spends: suppliers, utilities, maintenance, and operational costs.',
    steps: [
      'Record each expense with category and payment method.',
      'Keep descriptions clear for year-end reporting.',
      'Use reports to compare periods.',
    ],
  },
  payroll: {
    title: 'Payroll',
    tagline: 'Staff pay runs',
    purpose:
      'Prepare or review payroll cycles, allowances, and deductions for staff.',
    steps: [
      'Verify staff list and salaries before running a period.',
      'Check previews or totals before confirming.',
      'Export or print payslips if your workflow requires it.',
    ],
  },
  reports: {
    title: 'Reports',
    tagline: 'Analytics and exports',
    purpose:
      'Run advanced summaries across finance, attendance, and operations depending on access.',
    steps: [
      'Choose the report type and date range.',
      'Apply filters (class, term, category) before generating.',
      'Export or print results for meetings or auditors.',
    ],
  },
  'print-fee-status': {
    title: 'Fee status',
    tagline: 'Class fee statements',
    purpose:
      'Print or review per-class fee status: term fee, arrears, total due, paid, and balance—ideal for parent meetings.',
    steps: [
      'Select the class and load the report.',
      'Filter owing / paid if available.',
      'Use Print when the table looks correct.',
    ],
  },
  'manual-adjustments': {
    title: 'Balance overrides',
    tagline: 'Audited ledger corrections',
    purpose:
      'Search by student ID, review fee vs ledger balances, and post append-only manual adjustments tied to the current term. Everything is audited.',
    steps: [
      'Search and select the student.',
      'Review the fee row and official ledger balance.',
      'Open Manual balance override, enter the target ledger balance, reason, and notes.',
      'Optional: attach a document. Submit—arrears refresh in the background.',
    ],
    tips: ['No second approver is required; notes must be substantive for the audit trail.'],
  },
  records: {
    title: 'Records',
    tagline: 'Documents and files',
    purpose:
      'Central place for school records your deployment exposes—uploads, categories, or lookups as configured.',
    steps: [
      'Browse folders or filters provided on the page.',
      'Upload only files you are allowed to share school-wide.',
      'Rename or tag consistently so others can find documents.',
    ],
  },
  'push-notifications': {
    title: 'Push notifications',
    tagline: 'Broadcast to devices',
    purpose:
      'Send push messages to parents or staff who installed the app, for urgent or general announcements.',
    steps: [
      'Compose a short, clear title and body.',
      'Choose audience (e.g. all parents, one class) as offered.',
      'Send during appropriate hours; avoid duplicate blasts.',
    ],
  },
  'parent-desk': {
    title: 'Parent desk',
    tagline: 'Inbound parent messages',
    purpose:
      'Read and reply to messages from parents using the portal—similar to a simple helpdesk inbox.',
    steps: [
      'Open unread threads first.',
      'Reply in-thread with accurate information; avoid sharing sensitive data inappropriately.',
      'Mark resolved when the parent’s question is fully answered.',
    ],
  },
  'ai-assistant': {
    title: 'AI assistant',
    tagline: 'In-app help and drafting',
    purpose:
      'Ask questions about using the system or draft short text. Answers are assistive—always verify finance and policy details.',
    steps: [
      'Ask specific questions (“How do I record a partial payment?”).',
      'Do not paste passwords or confidential personal data.',
      'For account or billing disputes, still use Support Chat for ScholarNerve staff.',
    ],
  },
  'support-chat': {
    title: 'Support Chat',
    tagline: 'Talk to ScholarNerve',
    purpose:
      'Reach ScholarNerve support for bugs, access issues, or how-to questions that need a human. Include your school name and what you were trying to do.',
    steps: [
      'Start a new message with a clear subject.',
      'Describe steps you took and any error text you saw.',
      'Attach screenshots if they help; wait for a reply in this same thread.',
    ],
    tips: ['For training on a specific page, open User guide on that page first—it may answer immediately.'],
  },
  users: {
    title: 'Users',
    tagline: 'Logins and roles',
    purpose:
      'Create and manage user accounts that can sign in: administrators, finance, teachers, and permissions.',
    steps: [
      'Create users with correct role and tenant/school association.',
      'Deactivate instead of deleting when someone leaves, if that option exists.',
      'Reset passwords only through approved flows.',
    ],
    tips: ['Least privilege: give finance only finance, teachers only teaching modules.'],
  },
  settings: {
    title: 'Settings',
    tagline: 'School configuration',
    purpose:
      'Configure school name, logo, academic term, integrations, and other global options that drive the rest of the app.',
    steps: [
      'Review current term and year before fee posting or overrides.',
      'Update contact details shown on receipts or portals.',
      'Save after each logical group of changes.',
    ],
    tips: ['Changing term affects fee and override context—communicate with finance first.'],
  },
  audit: {
    title: 'Audit logs',
    tagline: 'Who did what',
    purpose:
      'Read-only trail of sensitive actions for accountability and troubleshooting.',
    steps: [
      'Filter by user, action, or date range if available.',
      'Use entries to correlate with support tickets.',
      'Do not expect to edit history—it is immutable by design.',
    ],
  },
};

export function getModuleUserGuide(moduleId: string): ModuleUserGuide {
  return MODULE_USER_GUIDES[moduleId] ?? DEFAULT_GUIDE(moduleId);
}
