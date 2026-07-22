export const PRICE_PER_STUDENT_TERM = 5;
export const ANNUAL_DISCOUNT = 0.1;
export const TERMS_PER_YEAR = 3;

export type BillingCycle = 'term' | 'year';

export type PricingTier = {
  students: number;
  popular?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  { students: 50 },
  { students: 100 },
  { students: 150 },
  { students: 200 },
  { students: 300 },
  { students: 400 },
  { students: 500 },
];

export function calcTermPrice(students: number): number {
  return students * PRICE_PER_STUDENT_TERM;
}

export function calcYearPrice(students: number): number {
  return Math.round(students * PRICE_PER_STUDENT_TERM * TERMS_PER_YEAR * (1 - ANNUAL_DISCOUNT));
}

export function calcMonthEquivalent(students: number): number {
  return Math.round(calcYearPrice(students) / 12);
}

export function calcYearSavings(students: number): number {
  return calcTermPrice(students) * TERMS_PER_YEAR - calcYearPrice(students);
}

export function formatGhs(amount: number): string {
  return `GHS ${amount.toLocaleString('en-GH')}`;
}

export type FeatureCategoryIcon =
  | 'students'
  | 'academics'
  | 'fees'
  | 'communication'
  | 'staff'
  | 'portals'
  | 'website'
  | 'security';

export type FeatureCategory = {
  icon: FeatureCategoryIcon;
  title: string;
  features: string[];
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    icon: 'students',
    title: 'Students',
    features: [
      'Register and manage all students',
      'Import students from Excel or CSV',
      'Generate student ID cards with QR code',
      'Upload birth certificates and photos',
      'Promote students to next class',
      'Assign students to classes and subjects',
    ],
  },
  {
    icon: 'academics',
    title: 'Classes & Academics',
    features: [
      'Set up your grading and marking scheme',
      'Record and publish student results',
      'Print official end-of-term report cards',
      'Full GES curriculum for JHS and primary',
      'Build class timetables for all subjects',
      'Schedule and manage exam timetables',
      'Run online exams on any device (CBT)',
      'Track student attendance daily',
      'View student progress over time',
      'Compare performance across classes',
    ],
  },
  {
    icon: 'fees',
    title: 'Fees & Payments',
    features: [
      'Track every student\'s fee balance',
      'Set different fees per class',
      'Record cash and bank payments',
      'Accept MoMo and card payments online',
      'Send payment reminders via SMS & WhatsApp',
      'Generate student fee invoices',
      'Automatically carry over unpaid balances',
      'View full finance reports anytime',
    ],
  },
  {
    icon: 'communication',
    title: 'Communication',
    features: [
      'Message teachers and staff in-app',
      'Send announcements to the whole school',
      'Receive and manage parent complaints',
      'Get instant notifications on your phone',
      'Chat with parents directly',
      'Send SMS and WhatsApp alerts',
    ],
  },
  {
    icon: 'staff',
    title: 'Teachers & Staff',
    features: [
      'Add teachers and create their accounts automatically',
      'Manage non-teaching staff',
      'Record staff attendance with location check',
      'Run staff payroll from the system',
      'Track school buses and transport',
    ],
  },
  {
    icon: 'portals',
    title: 'Dashboards & Portals',
    features: [
      'Full admin control dashboard',
      'Headmaster view of the whole school',
      'Teacher app — works without internet',
      'Parents can view results and pay fees online',
      'Students can access their portal',
    ],
  },
  {
    icon: 'website',
    title: 'Your School\'s Website',
    features: [
      'Get a free public website for your school',
      'Online admissions and enquiry forms',
      'Add photos and a school gallery',
      'Show school news and notices',
      'Show your school\'s contact and profile',
    ],
  },
  {
    icon: 'security',
    title: 'Security & Support',
    features: [
      'Your data is private and secure',
      'Daily automatic backups',
      'Free setup and onboarding help',
      'Free updates and new features forever',
      'Dedicated technical support',
      'Access to ScholarNerve partner network',
    ],
  },
];

export const TRUST_SCHOOLS = [
  'Light International Preparatory School',
  'Rosa Garden School',
  'Vision Prep School',
];

export const PRICING_FAQ = [
  {
    q: 'How does the 2-month free trial work?',
    a: 'When you sign up, your first 2 months are completely free. No credit card, no setup fee. Just create your account and start managing your school immediately.',
  },
  {
    q: 'What happens after the free trial?',
    a: 'After 2 months, you pay GHS 5 per enrolled student per term. We\'ll remind you before the trial ends.',
  },
  {
    q: 'Is every feature really included?',
    a: 'Yes. Every feature is fully premium — one plan, no tiers, no locked tools. Your school gets the complete platform from day one.',
  },
  {
    q: 'How do I pay my subscription?',
    a: 'We accept MoMo and bank transfer. Our team will reach out before your trial ends to complete your payment setup.',
  },
  {
    q: 'Can I add or remove students during the term?',
    a: 'Yes. Your billing is based on your enrolled student count at the start of each term.',
  },
  {
    q: 'Is my school\'s data secure?',
    a: 'Absolutely. All data is encrypted, backed up daily, and completely isolated from other schools on the platform.',
  },
  {
    q: 'What if I need help getting started?',
    a: 'Every school gets free onboarding support. Our team will help you set up your school, import your students, and train your staff.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No long-term contracts. Cancel anytime with no penalties.',
  },
] as const;

export const FREE_TRIAL_BULLETS = [
  '2 months completely free',
  'No credit card required',
  'No setup fees',
  'No hidden charges',
  'Cancel anytime',
] as const;
