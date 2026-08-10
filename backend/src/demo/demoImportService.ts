import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { getClient, query } from '../db/connection.js';
import { clearTenantData, writeSafetyBackup, resolvePrimaryAdminUserId, getPrimaryAdminProfile } from '../services/tenantBackupService.js';
import { bootstrapTenantChat } from '../services/chatService.js';
import { calculateGrade, calculatePositions, type AssessmentScore, type GradeConfig } from '../utils/gradeCalculator.js';
import { fetchDemoPortraitUrl, fetchDemoStudentPortraitUrl } from './demoAvatarUtils.js';
import { DEMO_SEED_JSON_PATH, loadDemoSeedData } from './demoSeedLoader.js';
import { seedDemoWebsiteContent } from './demoWebsiteSeed.js';
import { TERM_REPORT_REMARK_SUBJECT } from '../services/termReportRemarksService.js';

export type DemoSeedData = {
  version: string;
  academic_year: { key: string; name: string; label: string; start_date: string; end_date: string };
  academic_terms: Array<{
    key: string;
    term_name: string;
    year: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
  }>;
  terms: Array<{
    key: string;
    name: string;
    academic_term_key: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    status: string;
  }>;
  classes: Array<{
    key: string;
    class_name: string;
    level: string;
    level_order: number;
    form_teacher_key: string;
  }>;
  subjects: Array<{ key: string; name: string; code: string }>;
  teachers: Array<{
    key: string;
    staff_id: string;
    full_name: string;
    email: string;
    phone: string;
    gender: string;
    monthly_salary: number;
    primary_subject_key: string;
    date_of_birth?: string;
    address?: string;
    qualification?: string;
    specialization?: string;
    national_id?: string;
    position?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
  }>;
  other_staff: Array<{
    key: string;
    staff_id: string;
    full_name: string;
    position: string;
    phone: string;
    monthly_salary: number;
    gender?: string;
    email?: string;
    date_of_birth?: string;
    home_address?: string;
    national_id?: string;
  }>;
  fee_structure: {
    term_key: string;
    total_per_student: number;
    items: Array<{
      item_name: string;
      amount: number;
      sort_order: number;
      ledger_field: string;
    }>;
  };
  student_config: {
    count: number;
    admission_prefix: string;
    class_distribution: Array<{ class_key: string; count: number }>;
    payment_distribution: { full_paid: number; partial: number; unpaid: number; overpaid: number };
    term_fee_total: number;
    partial_payment_range: [number, number];
    overpaid_amount: number;
  };
  grades_config: {
    term_key: string;
    top_percent: number;
    bottom_percent: number;
    subject_variance: number;
  };
  grade_config?: {
    class_score_weight: number;
    exam_weight: number;
    exam_max_marks: number;
    components: Array<{
      name: string;
      weight_in_class_score: number;
      max_marks: number;
      display_order?: number;
    }>;
  };
  timetable_config?: {
    term_key: string;
    days: string[];
    subjects_per_day: number;
    periods: Array<{ name: string; start: string; end: string; is_break: boolean }>;
    exam_venue?: string;
  };
  photo_config?: { students?: boolean; teachers?: boolean; staff?: boolean };
  finance_config?: {
    payment_accounts: Array<{
      key: string;
      account_type: 'cash' | 'bank' | 'momo';
      account_name: string;
      nickname?: string;
      account_number?: string;
      branch?: string;
      network?: string;
      phone_number?: string;
      opening_balance: number;
      opening_balance_days_ago?: number;
      is_default?: boolean;
    }>;
    school_payment_settings?: Record<string, string>;
    paystack?: {
      enabled: boolean;
      super_admin_enabled?: boolean;
      mode: string;
      fee_bearer?: string;
      online_payment_count?: number;
    };
    income?: Array<{
      source: string;
      amount: number;
      days_ago: number;
      category: string;
      account_key: string;
      received_by?: string;
    }>;
    expenses?: Array<{
      title: string;
      amount: number;
      days_ago: number;
      category: string;
      account_key: string;
      payee_name?: string;
      vendor?: string;
    }>;
    fund_transfers?: Array<{
      from_key: string;
      to_key: string;
      amount: number;
      days_ago: number;
      note: string;
    }>;
    academic_reports?: {
      graduated_student_indices?: number[];
      leaver_student_indices?: number[];
    };
  };
  payroll_config: {
    term_key: string;
    payment_month: number;
    payment_year: number;
    transport_allowance: number;
    housing_allowance: number;
    ssnit_percent: number;
    income_tax_percent: number;
  };
  teacher_password_plain: string;
  payment_config?: { window_days: number; anchor: string; methods: string[] };
  attendance_config?: { school_days_back: number; present_rate_min: number; present_rate_max: number };
  staff_clock_in_config?: {
    days_back: number;
    school_start: string;
    school_end: string;
    late_rate: number;
    late_reasons: string[];
  };
  school_attendance_settings?: {
    latitude: number;
    longitude: number;
    radius_meters: number;
    school_start_time: string;
    school_end_time: string;
    late_threshold_minutes: number;
  };
  student_profile_defaults?: {
    nationality: string;
    home_address_area: string;
    previous_school: string;
    date_of_admission: string;
    number_of_siblings_range: [number, number];
    guardian_relationships: string[];
  };
  teacher_profile_defaults?: Record<string, string>;
  staff_profile_defaults?: Record<string, unknown>;
  parent_portal_config?: { create_for_first_n_students: number; password_uses_admission_number: boolean };
  chat_seed?: {
    channels: Array<{
      channel_type: string;
      messages: Array<{ sender_teacher_key?: string; sender_staff_key?: string; text: string; days_ago: number }>;
    }>;
  };
  parent_messages_seed?: Array<{
    student_index: number;
    type: string;
    subject: string;
    message: string;
    days_ago: number;
    status: string;
    is_read_by_school: boolean;
  }>;
  complaints_seed?: Array<{
    complaint_type: 'student' | 'teacher';
    filed_by_teacher_key: string;
    subject_student_index?: number;
    subject_teacher_key?: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    is_anonymous?: boolean;
    days_ago?: number;
    resolution_note?: string;
  }>;
  male_first_names: string[];
  female_first_names: string[];
  last_names: string[];
  website_seed?: {
    auto_enable?: boolean;
    accent_color?: string;
    banner_image_key?: string;
    welcome_image_key?: string;
    welcome_image_secondary_key?: string;
    tagline?: string;
    welcome_text?: string;
    stats?: { founded_year?: number; student_count?: number; programs_count?: number; pass_rate?: string };
    social_links?: Record<string, string>;
    home_content?: Record<string, string | null>;
    highlights?: Array<{ icon?: string; title: string; description?: string }>;
    about?: {
      director_teacher_key?: string;
      director_image_key?: string;
      director_title?: string;
      director_name?: string;
      director_message?: string;
      history?: string;
      vision?: string;
      mission?: string;
      core_values?: string[];
      institution_overview?: string;
      history_image_key?: string;
      overview_image_key?: string;
    };
    admission?: {
      requirements?: string;
      programs?: string[];
      applications_open?: boolean;
      open_date?: string;
      close_date?: string;
    };
    contact?: Record<string, string>;
    gallery?: Array<{ image_key: string; category?: string; sort_order?: number }>;
    events?: Array<{
      title: string;
      description?: string;
      days_from_now?: number;
      event_date?: string;
      event_time?: string;
      location?: string;
      cover_image_key?: string;
      sort_order?: number;
    }>;
    leadership?: Array<{
      teacher_key?: string;
      staff_key?: string;
      full_name?: string;
      position?: string;
      bio?: string;
      sort_order?: number;
    }>;
    teachers?: Array<{
      teacher_key: string;
      position?: string;
      subjects?: string[];
      bio?: string;
      sort_order?: number;
    }>;
  };
};

export type DemoImportSummary = {
  tenantId: number;
  slug: string;
  students: number;
  teachers: number;
  otherStaff: number;
  payments: { full_paid: number; partial: number; unpaid: number; overpaid: number };
  reportCardsPublished: number;
  assessments?: number;
  timetableSlots?: number;
  examTimetableEntries?: number;
  profilePhotos?: number;
  attendanceRecords?: number;
  staffClockIns?: number;
  chatMessages?: number;
  parentMessages?: number;
  complaints?: number;
  paymentAccounts?: number;
  incomeEntries?: number;
  expenseEntries?: number;
  paystackPayments?: number;
  fundTransfers?: number;
  websiteGallery?: number;
  websiteEvents?: number;
  websiteTeam?: number;
};

type IdMap = Map<string, number>;

function logStep(ok: boolean, message: string, detail?: string) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${message}${detail ? ` — ${detail}` : ''}`);
}

export { DEMO_SEED_JSON_PATH, loadDemoSeedData } from './demoSeedLoader.js';

export async function resolvePrimaryAdminId(client: pg.PoolClient, tenantId: number): Promise<number | null> {
  return resolvePrimaryAdminUserId(client, tenantId);
}

export { getPrimaryAdminProfile };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function randBetween(min: number, max: number, seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  const r = x - Math.floor(x);
  return Math.round(min + r * (max - min));
}

function beceGrade(total: number): string {
  if (total >= 80) return 'A1';
  if (total >= 70) return 'B2';
  if (total >= 60) return 'B3';
  if (total >= 55) return 'C4';
  if (total >= 50) return 'C5';
  if (total >= 45) return 'C6';
  if (total >= 40) return 'D7';
  if (total >= 35) return 'E8';
  return 'F9';
}

function remarkFromGrade(grade: string): string {
  if (grade === 'A1' || grade === 'B2') return 'Excellent';
  if (grade === 'B3') return 'Very Good';
  if (grade === 'C4' || grade === 'C5') return 'Good';
  if (grade === 'C6' || grade === 'D7') return 'Average';
  if (grade === 'E8') return 'Below Average';
  return 'Poor';
}

const DEMO_CONDUCT = [
  'Well-behaved',
  'Respectful',
  'Obedient',
  'Polite',
  'Calm and courteous',
  'Disciplined',
  'Cooperative',
  'Honest',
  'Responsible',
  'Mature for age',
];

const DEMO_ATTITUDE = [
  'Hardworking',
  'Enthusiastic',
  'Positive',
  'Diligent',
  'Attentive in class',
  'Self-motivated',
  'Eager to learn',
  'Committed',
  'Punctual',
  'Team-oriented',
];

const DEMO_INTERESTS = [
  'Reading',
  'Football',
  'Music & choir',
  'Science club',
  'ICT',
  'Creative arts',
  'Athletics',
  'Debate club',
  'Mathematics',
  'Community service',
];

function promotedToForClass(classKey: string): string {
  if (classKey === 'class4') return 'Class 5';
  if (classKey === 'class6') return 'JHS 1';
  if (classKey === 'jhs2') return 'JHS 3';
  return 'Next class';
}

function formatReopeningDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = d.toLocaleString('en-GB', { month: 'long' });
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

function buildDemoTeacherRemarkBundle(opts: {
  position: number;
  classSize: number;
  avgPercent: number;
  overallGrade: string;
  studentIndex: number;
  promotedTo: string;
  reopeningDate: string;
  attendanceDays: number;
  attendanceOutOf: number;
}): string {
  const { position, classSize, avgPercent, overallGrade, studentIndex, promotedTo, reopeningDate, attendanceDays, attendanceOutOf } =
    opts;
  const quality = remarkFromGrade(overallGrade).toLowerCase();
  let text: string;
  if (position <= 3) {
    text = `An outstanding pupil ranked ${position} in class with ${avgPercent}% average. ${remarkFromGrade(overallGrade)} work — keep leading by example.`;
  } else if (position <= Math.ceil(classSize * 0.4)) {
    text = `A ${quality} pupil ranked ${position} in class. Shows steady progress and good classroom conduct.`;
  } else if (position <= Math.ceil(classSize * 0.75)) {
    text = `Ranked ${position} in class. Can improve with more consistent study and participation.`;
  } else {
    text = `Ranked ${position} in class. Needs greater focus on homework and classwork next term.`;
  }

  return JSON.stringify({
    text,
    conduct: DEMO_CONDUCT[studentIndex % DEMO_CONDUCT.length],
    attitude: DEMO_ATTITUDE[studentIndex % DEMO_ATTITUDE.length],
    interest: DEMO_INTERESTS[studentIndex % DEMO_INTERESTS.length],
    attendance: String(attendanceDays),
    attendanceOutOf: String(attendanceOutOf),
    promotedTo,
    reopeningDate,
  });
}

function randomDateInRange(start: string, end: string, seed: number): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const t = s + ((Math.abs(Math.sin(seed * 777)) % 1) * (e - s));
  return new Date(t).toISOString().slice(0, 10);
}

function daysAgoDate(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function daysAgoTimestamp(daysAgo: number, time = '08:15:00'): string {
  return `${daysAgoDate(daysAgo)}T${time}+00:00`;
}

function recentWeekdays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

function paymentDayForIndex(index: number, windowDays: number): string {
  const bucket = index % windowDays;
  const jitter = (index * 7) % 3;
  return daysAgoDate(Math.min(windowDays - 1, Math.max(0, bucket + jitter)));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function studentKeysInClass(
  studentKeys: string[],
  classDistribution: DemoSeedData['student_config']['class_distribution'],
  classKey: string
): string[] {
  return studentKeys.filter((k) => {
    const idx = parseInt(k.replace('stu_', ''), 10) - 1;
    let offset = 0;
    for (const dist of classDistribution) {
      if (idx < offset + dist.count) return dist.class_key === classKey;
      offset += dist.count;
    }
    return false;
  });
}

function teacherForSubject(seed: DemoSeedData, subjKey: string, fallbackIndex: number) {
  return seed.teachers.find((t) => t.primary_subject_key === subjKey) || seed.teachers[fallbackIndex % seed.teachers.length];
}

async function seedDemoGradeConfig(
  client: pg.PoolClient,
  tenantId: number,
  gradeConfig: NonNullable<DemoSeedData['grade_config']>
): Promise<Map<string, { id: number; maxMarks: number }>> {
  const componentMap = new Map<string, { id: number; maxMarks: number }>();

  await client.query(
    `INSERT INTO grade_configs (tenant_id, class_score_weight, exam_weight)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET
       class_score_weight = EXCLUDED.class_score_weight,
       exam_weight = EXCLUDED.exam_weight,
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, gradeConfig.class_score_weight, gradeConfig.exam_weight]
  );

  const configRes = await client.query(`SELECT id FROM grade_configs WHERE tenant_id = $1`, [tenantId]);
  const configId = Number(configRes.rows[0].id);

  await client.query(`DELETE FROM grade_config_components WHERE tenant_id = $1`, [tenantId]);

  for (const comp of gradeConfig.components) {
    const r = await client.query(
      `INSERT INTO grade_config_components (grade_config_id, tenant_id, name, weight_in_class_score, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [configId, tenantId, comp.name, comp.weight_in_class_score, comp.display_order ?? 0]
    );
    componentMap.set(comp.name, { id: Number(r.rows[0].id), maxMarks: comp.max_marks });
  }

  const boundCount = await client.query(`SELECT 1 FROM grade_boundaries WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  if (boundCount.rows.length === 0) {
    const bounds = [
      ['A1', 80, 100, 'Excellent', 1],
      ['B2', 70, 79, 'Very Good', 2],
      ['B3', 60, 69, 'Good', 3],
      ['C4', 55, 59, 'Credit', 4],
      ['C5', 50, 54, 'Credit', 5],
      ['C6', 45, 49, 'Credit', 6],
      ['D7', 40, 44, 'Pass', 7],
      ['E8', 35, 39, 'Pass', 8],
      ['F9', 0, 34, 'Fail', 9],
    ] as const;
    for (const [label, minP, maxP, remark, ord] of bounds) {
      await client.query(
        `INSERT INTO grade_boundaries (tenant_id, grade_label, min_percent, max_percent, remark, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, label, minP, maxP, remark, ord]
      );
    }
  }

  return componentMap;
}

function buildCalculatorGradeConfig(
  gradeConfig: NonNullable<DemoSeedData['grade_config']>,
  componentMap: Map<string, { id: number; maxMarks: number }>
): GradeConfig {
  return {
    classScoreWeight: gradeConfig.class_score_weight,
    examWeight: gradeConfig.exam_weight,
    components: gradeConfig.components.map((c) => ({
      id: componentMap.get(c.name)!.id,
      name: c.name,
      weightInClassScore: c.weight_in_class_score,
    })),
    boundaries: [
      { gradeLabel: 'A1', minPercent: 80, maxPercent: 100, remark: 'Excellent' },
      { gradeLabel: 'B2', minPercent: 70, maxPercent: 79, remark: 'Very Good' },
      { gradeLabel: 'B3', minPercent: 60, maxPercent: 69, remark: 'Good' },
      { gradeLabel: 'C4', minPercent: 55, maxPercent: 59, remark: 'Credit' },
      { gradeLabel: 'C5', minPercent: 50, maxPercent: 54, remark: 'Credit' },
      { gradeLabel: 'C6', minPercent: 45, maxPercent: 49, remark: 'Credit' },
      { gradeLabel: 'D7', minPercent: 40, maxPercent: 44, remark: 'Pass' },
      { gradeLabel: 'E8', minPercent: 35, maxPercent: 39, remark: 'Pass' },
      { gradeLabel: 'F9', minPercent: 0, maxPercent: 34, remark: 'Fail' },
    ],
  };
}

function targetPercentForStudent(
  rankIndex: number,
  classSize: number,
  gc: DemoSeedData['grades_config'],
  seed: number
): number {
  const spread = gc.top_percent - gc.bottom_percent;
  const percentile = classSize <= 1 ? 0 : rankIndex / (classSize - 1);
  const base = gc.top_percent - percentile * spread;
  const noise = randBetween(-4, 4, seed);
  return clamp(base + noise, 32, 98);
}

function rawScoreForTarget(targetPercent: number, maxMarks: number, seed: number): number {
  const noise = randBetween(-6, 6, seed) / 100;
  const fraction = clamp(targetPercent / 100 + noise, 0.05, 0.99);
  return clamp(Math.round(fraction * maxMarks), 0, maxMarks);
}

async function seedDemoProfilePhotos(
  client: pg.PoolClient,
  tenantId: number,
  seed: DemoSeedData,
  ids: IdMap,
  studentKeys: string[],
  sc: DemoSeedData['student_config']
): Promise<number> {
  if (seed.photo_config?.students === false && seed.photo_config?.teachers === false && seed.photo_config?.staff === false) {
    return 0;
  }

  let count = 0;

  if (seed.photo_config?.teachers !== false) {
    for (const t of seed.teachers) {
      const photoUrl = await fetchDemoPortraitUrl(t.full_name, t.gender, ids.get(t.key)!);
      await client.query(`UPDATE teachers SET passport_photo_url = $1 WHERE id = $2 AND tenant_id = $3`, [
        photoUrl,
        ids.get(t.key)!,
        tenantId,
      ]);
      count++;
    }
  }

  if (seed.photo_config?.staff !== false) {
    for (const s of seed.other_staff) {
      const photoUrl = await fetchDemoPortraitUrl(s.full_name, s.gender || 'Male', ids.get(s.key)!);
      await client.query(`UPDATE other_staff SET passport_photo_url = $1 WHERE id = $2 AND tenant_id = $3`, [
        photoUrl,
        ids.get(s.key)!,
        tenantId,
      ]);
      count++;
    }
  }

  if (seed.photo_config?.students !== false) {
    for (const key of studentKeys) {
      const idx = parseInt(key.replace('stu_', ''), 10);
      const stuId = ids.get(key)!;
      const genderRes = await client.query(`SELECT first_name, last_name, gender FROM students WHERE id = $1`, [stuId]);
      const row = genderRes.rows[0];
      const fullName = `${row?.first_name || 'Student'} ${row?.last_name || ''}`.trim();
      const gender = String(row?.gender || 'Male');
      const photoUrl = await fetchDemoStudentPortraitUrl(fullName, gender, idx);
      await client.query(`UPDATE students SET passport_photo_url = $1 WHERE id = $2 AND tenant_id = $3`, [
        photoUrl,
        stuId,
        tenantId,
      ]);
      count++;
    }
  }

  return count;
}

function accountIdForMethod(
  accountIds: Map<string, number>,
  method: string,
  index: number
): number | null {
  if (method === 'cash') return accountIds.get('cash') ?? null;
  if (method === 'bank') return accountIds.get('bank') ?? null;
  if (method === 'momo') return index % 2 === 0 ? accountIds.get('momo_mtn') ?? null : accountIds.get('momo_telecel') ?? null;
  if (method === 'online') return accountIds.get('bank') ?? null;
  return accountIds.get('cash') ?? null;
}

async function seedDemoFinance(
  client: pg.PoolClient,
  tenantId: number,
  seed: DemoSeedData,
  ids: IdMap,
  studentKeys: string[],
  sc: DemoSeedData['student_config'],
  opts: {
    ayId: number;
    term1Id: number;
    term1Name: string;
    academicYearLabel: string;
    academicTermId: number;
    primaryAdminId: number | null;
    recordedByUserId: number | null;
  }
): Promise<{
  accountIds: Map<string, number>;
  paystackCount: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  payCounts: { full_paid: number; partial: number; unpaid: number; overpaid: number };
}> {
  const fc = seed.finance_config;
  const accountIds = new Map<string, number>();
  let paystackCount = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;
  const pd = sc.payment_distribution;
  const payCounts = { full_paid: 0, partial: 0, unpaid: 0, overpaid: 0 };

  if (!fc) {
    return { accountIds, paystackCount, incomeCount, expenseCount, transferCount, payCounts };
  }

  for (const ac of fc.payment_accounts) {
    const asOf = daysAgoDate(ac.opening_balance_days_ago ?? 45);
    const r = await client.query(
      `INSERT INTO payment_accounts (
         tenant_id, account_type, account_name, nickname, account_number, branch,
         network, phone_number, opening_balance, opening_balance_as_of,
         opening_balance_configured, is_active, is_default
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,true,$11)
       RETURNING id`,
      [
        tenantId,
        ac.account_type,
        ac.account_name,
        ac.nickname ?? null,
        ac.account_number ?? null,
        ac.branch ?? null,
        ac.network ?? null,
        ac.phone_number ?? null,
        ac.opening_balance,
        asOf,
        ac.is_default ?? false,
      ]
    );
    accountIds.set(ac.key, Number(r.rows[0].id));
  }

  const sps = fc.school_payment_settings;
  if (sps) {
    await client.query(
      `INSERT INTO school_payment_settings (
         tenant_id, mtn_momo_number, mtn_momo_name, vodafone_cash_number, vodafone_cash_name,
         airteltigo_number, airteltigo_name, bank_name, bank_account_number, bank_account_name,
         payment_instructions, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         mtn_momo_number = EXCLUDED.mtn_momo_number,
         mtn_momo_name = EXCLUDED.mtn_momo_name,
         vodafone_cash_number = EXCLUDED.vodafone_cash_number,
         vodafone_cash_name = EXCLUDED.vodafone_cash_name,
         airteltigo_number = EXCLUDED.airteltigo_number,
         airteltigo_name = EXCLUDED.airteltigo_name,
         bank_name = EXCLUDED.bank_name,
         bank_account_number = EXCLUDED.bank_account_number,
         bank_account_name = EXCLUDED.bank_account_name,
         payment_instructions = EXCLUDED.payment_instructions,
         updated_at = NOW()`,
      [
        tenantId,
        sps.mtn_momo_number ?? null,
        sps.mtn_momo_name ?? null,
        sps.vodafone_cash_number ?? null,
        sps.vodafone_cash_name ?? null,
        sps.airteltigo_number ?? null,
        sps.airteltigo_name ?? null,
        sps.bank_name ?? null,
        sps.bank_account_number ?? null,
        sps.bank_account_name ?? null,
        sps.payment_instructions ?? null,
      ]
    ).catch(() => undefined);
  }

  const ps = fc.paystack;
  if (ps) {
    await client.query(
      `INSERT INTO tenant_paystack_config (tenant_id, mode, enabled, super_admin_enabled, fee_bearer, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         mode = EXCLUDED.mode,
         enabled = EXCLUDED.enabled,
         super_admin_enabled = EXCLUDED.super_admin_enabled,
         fee_bearer = EXCLUDED.fee_bearer,
         updated_at = NOW()`,
      [
        tenantId,
        ps.mode || 'scholarnerve',
        ps.enabled ?? true,
        ps.super_admin_enabled ?? true,
        ps.fee_bearer || 'parent',
      ]
    ).catch(() => undefined);
  }

  // Fee payments with account links + Paystack online payments
  const payWindow = seed.payment_config?.window_days ?? 30;
  const payMethods = seed.payment_config?.methods ?? ['cash', 'momo', 'bank'];
  const onlineCount = ps?.online_payment_count ?? 0;
  let receiptSeq = 1001;
  let onlineSeq = 0;

  for (let i = 0; i < studentKeys.length; i++) {
    let amount = 0;
    let bucket: keyof typeof payCounts = 'unpaid';
    if (i < pd.full_paid) {
      amount = sc.term_fee_total;
      bucket = 'full_paid';
    } else if (i < pd.full_paid + pd.partial) {
      amount = randBetween(sc.partial_payment_range[0], sc.partial_payment_range[1], i + 50);
      bucket = 'partial';
    } else if (i < pd.full_paid + pd.partial + pd.unpaid) {
      amount = 0;
      bucket = 'unpaid';
    } else {
      amount = sc.overpaid_amount;
      bucket = 'overpaid';
    }
    payCounts[bucket]++;

    const sid = ids.get(studentKeys[i])!;
    if (amount <= 0) continue;

    const payDate = paymentDayForIndex(i, payWindow);
    const receiptNumber = `R-DEMO-${String(receiptSeq++).padStart(5, '0')}`;
    const useOnline = onlineSeq < onlineCount && i < pd.full_paid + pd.partial;

    if (useOnline) {
      onlineSeq++;
      const amountKobo = Math.round(amount * 100);
      const feeKobo = Math.round(amountKobo * 0.0195);
      const reference = `SN-DEMO-${tenantId}-${sid}-${onlineSeq}`;
      const paidAt = `${payDate}T14:30:00+00:00`;

      const txRes = await client.query(
        `INSERT INTO payment_transactions (
           tenant_id, student_id, reference, amount_kobo, fee_kobo, total_kobo,
           status, mode, paystack_id, payment_channel, paid_at, metadata, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'success',$7,$8,$9,$10::timestamptz,$11::jsonb,NOW(),NOW())
         RETURNING id`,
        [
          tenantId,
          sid,
          reference,
          amountKobo,
          feeKobo,
          amountKobo + feeKobo,
          ps?.mode || 'scholarnerve',
          `PS-DEMO-${100000 + onlineSeq}`,
          onlineSeq % 2 === 0 ? 'card' : 'mobile_money',
          paidAt,
          JSON.stringify({ source: 'demo_seed', receipt_number: receiptNumber, channel: 'paystack' }),
        ]
      );

      const payRes = await client.query(
        `INSERT INTO payments (
           tenant_id, student_id, amount, payment_date, payment_method, term, term_id,
           receipt_number, base_receipt_number, payment_category, payment_account_id, payment_transaction_id
         ) VALUES ($1,$2,$3,$4,'online',$5,$6,$7,$7,'term_fee',$8,$9)
         RETURNING id`,
        [
          tenantId,
          sid,
          amount,
          payDate,
          opts.term1Name,
          opts.term1Id,
          receiptNumber,
          accountIdForMethod(accountIds, 'online', i),
          txRes.rows[0].id,
        ]
      );

      await client.query(
        `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, payment_method, receipt_number, payment_id)
         VALUES ($1,$2,$3,$4,$5,0,$6,'payment','online',$7,$8)`,
        [
          tenantId,
          sid,
          opts.ayId,
          opts.term1Id,
          `Paystack online payment — Receipt #${receiptNumber}`,
          amount,
          receiptNumber,
          payRes.rows[0].id,
        ]
      );
      paystackCount++;
      continue;
    }

    const method = payMethods[i % payMethods.length];
    const accountId = accountIdForMethod(accountIds, method, i);

    const payRes = await client.query(
      `INSERT INTO payments (
         tenant_id, student_id, amount, payment_date, payment_method, term, term_id,
         receipt_number, base_receipt_number, payment_category, payment_account_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,'term_fee',$9)
       RETURNING id`,
      [
        tenantId,
        sid,
        amount,
        payDate,
        method,
        opts.term1Name,
        opts.term1Id,
        receiptNumber,
        accountId,
      ]
    );

    await client.query(
      `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, payment_method, receipt_number, payment_id)
       VALUES ($1,$2,$3,$4,$5,0,$6,'payment',$7,$8,$9)`,
      [
        tenantId,
        sid,
        opts.ayId,
        opts.term1Id,
        `Payment — Receipt #${receiptNumber}`,
        amount,
        method,
        receiptNumber,
        payRes.rows[0].id,
      ]
    );
  }

  for (const inc of fc.income ?? []) {
    const accountId = accountIds.get(inc.account_key) ?? null;
    await client.query(
      `INSERT INTO income (tenant_id, source, amount, income_date, payment_method, payment_account_id, received_by, category, term, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tenantId,
        inc.source,
        inc.amount,
        daysAgoDate(inc.days_ago),
        inc.account_key === 'cash' ? 'Cash' : inc.account_key.includes('momo') ? 'Mobile Money' : 'Bank Transfer',
        accountId,
        inc.received_by ?? 'School Bursar',
        inc.category,
        opts.term1Name,
        opts.academicYearLabel,
      ]
    );
    incomeCount++;
  }

  for (const exp of fc.expenses ?? []) {
    const accountId = accountIds.get(exp.account_key) ?? null;
    await client.query(
      `INSERT INTO expenses (tenant_id, title, category, amount, payee_name, payment_date, payment_method, payment_account_id, vendor, term, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        tenantId,
        exp.title,
        exp.category,
        exp.amount,
        exp.payee_name ?? exp.vendor ?? 'Vendor',
        daysAgoDate(exp.days_ago),
        exp.account_key === 'cash' ? 'Cash' : exp.account_key.includes('momo') ? 'Mobile Money' : 'Bank Transfer',
        accountId,
        exp.vendor ?? null,
        opts.term1Name,
        opts.academicYearLabel,
      ]
    );
    expenseCount++;
  }

  for (const tr of fc.fund_transfers ?? []) {
    const fromId = accountIds.get(tr.from_key);
    const toId = accountIds.get(tr.to_key);
    if (!fromId || !toId) continue;
    await client.query(
      `INSERT INTO fund_transfers (tenant_id, from_account_id, to_account_id, amount, transfer_date, note, transferred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        tenantId,
        fromId,
        toId,
        tr.amount,
        daysAgoDate(tr.days_ago),
        tr.note,
        opts.primaryAdminId ?? opts.recordedByUserId,
      ]
    );
    transferCount++;
  }

  const ar = fc.academic_reports;
  if (ar?.leaver_student_indices?.length) {
    for (const idx of ar.leaver_student_indices) {
      const key = `stu_${String(idx).padStart(3, '0')}`;
      const stuId = ids.get(key);
      if (!stuId) continue;
      await client.query(
        `UPDATE students SET
           enrollment_status = 'withdrawn',
           inactivated_at = $3::timestamptz,
           inactivated_academic_term_id = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [stuId, tenantId, daysAgoTimestamp(10 + (idx % 5), '11:00:00'), opts.academicTermId]
      );
    }
  }

  if (ar?.graduated_student_indices?.length) {
    for (const idx of ar.graduated_student_indices) {
      const key = `stu_${String(idx).padStart(3, '0')}`;
      const stuId = ids.get(key);
      if (!stuId) continue;
      const classRes = await client.query(`SELECT class_assigned_id FROM students WHERE id = $1`, [stuId]);
      const classId = classRes.rows[0]?.class_assigned_id;
      if (!classId) continue;
      await client.query(
        `INSERT INTO graduation_details (tenant_id, student_id, class_id, academic_year_id, graduated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz)
         ON CONFLICT (tenant_id, student_id, academic_year_id) DO UPDATE SET graduated_at = EXCLUDED.graduated_at`,
        [tenantId, stuId, classId, opts.ayId, daysAgoTimestamp(7 + (idx % 4), '15:00:00')]
      );
    }
  }

  return { accountIds, paystackCount, incomeCount, expenseCount, transferCount, payCounts };
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function importDemoDataForTenant(
  tenantId: number,
  options?: { skipSafetyBackup?: boolean; jsonPath?: string }
): Promise<DemoImportSummary> {
  const seed = loadDemoSeedData(options?.jsonPath ?? DEMO_SEED_JSON_PATH);
  const ids: IdMap = new Map();

  const tenantRes = await query('SELECT id, slug, name FROM tenants WHERE id = $1', [tenantId]);
  if (tenantRes.rows.length === 0) {
    throw new Error(`Tenant ${tenantId} not found`);
  }
  const slug = String(tenantRes.rows[0].slug || tenantId);
  const schoolName = String(tenantRes.rows[0].name || slug);

  const preflightClient = await getClient();
  let primaryAdminId: number | null;
  try {
    primaryAdminId = await resolvePrimaryAdminUserId(preflightClient, tenantId);
  } finally {
    preflightClient.release();
  }
  if (!primaryAdminId) {
    throw new Error(
      `Tenant ${tenantId} (${schoolName}) has no primary admin user. Create an administrator account before loading demo data.`
    );
  }
  logStep(true, 'Pre-flight: primary admin found', `id=${primaryAdminId}`);

  if (!options?.skipSafetyBackup) {
    await writeSafetyBackup(tenantId, 'pre-demo-import');
  }

  const client = await getClient();
  const passwordHash = await hashPassword(seed.teacher_password_plain);

  try {
    await client.query('BEGIN');

    logStep(true, 'Resolved primary admin', `id=${primaryAdminId}`);

    const clearResult = await clearTenantData(client, tenantId, {
      keepTenant: true,
      preserveAccounts: false,
      preserveUserId: primaryAdminId,
    });

    if (!clearResult.preservedAdmin?.id) {
      throw new Error(`Primary admin #${primaryAdminId} was not preserved after tenant clear`);
    }
    logStep(
      true,
      'Tenant cleared for demo import',
      `${clearResult.deletedTables} tables · admin ${clearResult.preservedAdmin.email || clearResult.preservedAdmin.name}`
    );

    // Academic year
    const ay = seed.academic_year;
    const ayRes = await client.query(
      `INSERT INTO academic_years (tenant_id, name, label, start_date, end_date, is_current, status)
       VALUES ($1, $2, $3, $4, $5, true, 'active')
       RETURNING id`,
      [tenantId, ay.name, ay.label, ay.start_date, ay.end_date]
    );
    ids.set(ay.key, Number(ayRes.rows[0].id));
    logStep(true, 'Inserted academic year', ay.name);

    // Academic terms
    for (const at of seed.academic_terms) {
      const r = await client.query(
        `INSERT INTO academic_terms (tenant_id, term_name, year, start_date, end_date, is_active, is_archived)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id`,
        [tenantId, at.term_name, at.year, at.start_date, at.end_date, at.is_active]
      );
      ids.set(at.key, Number(r.rows[0].id));
    }
    logStep(true, `Inserted ${seed.academic_terms.length} academic terms`);

    // Ledger terms
    for (const t of seed.terms) {
      const r = await client.query(
        `INSERT INTO terms (tenant_id, academic_year_id, name, is_current, status, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          tenantId,
          ids.get(ay.key)!,
          t.name,
          t.is_current,
          t.status,
          t.start_date,
          t.end_date,
        ]
      );
      ids.set(t.key, Number(r.rows[0].id));
      const atId = ids.get(t.academic_term_key);
      if (atId) {
        await client.query(`UPDATE academic_terms SET ledger_term_id = $1 WHERE id = $2 AND tenant_id = $3`, [
          r.rows[0].id,
          atId,
          tenantId,
        ]).catch(() => undefined);
      }
    }
    logStep(true, `Inserted ${seed.terms.length} ledger terms`);

    const activeTerm = seed.terms.find((t) => t.is_current) || seed.terms[0];
    await client.query(
      `INSERT INTO school_settings (tenant_id, school_name, current_year, current_term)
       SELECT id, name, $2, $3 FROM tenants WHERE id = $1
       ON CONFLICT (tenant_id) DO UPDATE SET current_year = EXCLUDED.current_year, current_term = EXCLUDED.current_term, updated_at = CURRENT_TIMESTAMP`,
      [tenantId, ay.name, activeTerm.name]
    );

    // Subjects
    for (const s of seed.subjects) {
      const r = await client.query(
        `INSERT INTO subjects (tenant_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
        [tenantId, s.name, s.code]
      );
      ids.set(s.key, Number(r.rows[0].id));
    }
    logStep(true, `Inserted ${seed.subjects.length} subjects`);

    // Teachers (before classes — form teachers linked after)
    const tpd = seed.teacher_profile_defaults || {};
    for (const t of seed.teachers) {
      const subjName = seed.subjects.find((s) => s.key === t.primary_subject_key)?.name || 'General';
      const r = await client.query(
        `INSERT INTO teachers (
           tenant_id, staff_id, full_name, email, phone_number, gender, monthly_salary, employment_status,
           subjects_taught, date_of_birth, address, employment_date, qualification, specialization, national_id,
           position, department, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
           bank_name, bank_branch, bank_account_number, bank_account_name, employment_type, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'active')
         RETURNING id`,
        [
          tenantId,
          t.staff_id,
          t.full_name,
          t.email,
          t.phone,
          t.gender,
          t.monthly_salary,
          [subjName],
          t.date_of_birth || '1990-01-01',
          t.address || `${t.full_name}, Accra`,
          tpd.employment_date || '2019-09-01',
          t.qualification || tpd.qualification || 'B.Ed',
          t.specialization || subjName,
          t.national_id || `GHA-DEMO-${t.staff_id}`,
          t.position || 'Teacher',
          tpd.department || 'Academics',
          t.emergency_contact_name || `${t.full_name} Contact`,
          t.emergency_contact_phone || t.phone,
          t.emergency_contact_relationship || 'Spouse',
          tpd.bank_name || 'GCB Bank',
          tpd.bank_branch || 'Accra Main',
          `100${t.staff_id.replace(/\D/g, '').slice(-6)}`,
          t.full_name,
          tpd.employment_type || 'Full-time',
        ]
      );
      ids.set(t.key, Number(r.rows[0].id));

      const username = t.staff_id;
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id, is_active, is_primary_admin)
         VALUES ($1, $2, $3, $4, $5, 'teacher', $6, true, false)
         RETURNING id`,
        [tenantId, username, t.full_name, t.email, passwordHash, String(r.rows[0].id)]
      );
      ids.set(`user_${t.key}`, Number(userRes.rows[0].id));
    }
    logStep(true, `Inserted ${seed.teachers.length} teachers + user accounts`);

    // Classes
    for (const c of seed.classes) {
      const formTeacherId = ids.get(c.form_teacher_key);
      const r = await client.query(
        `INSERT INTO classes (tenant_id, class_name, level, level_order, assigned_teacher_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [tenantId, c.class_name, c.level, c.level_order, formTeacherId ?? null]
      );
      ids.set(c.key, Number(r.rows[0].id));
      if (formTeacherId) {
        await client.query(
          `INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_main)
           VALUES ($1, $2, $3, true)
           ON CONFLICT DO NOTHING`,
          [tenantId, r.rows[0].id, formTeacherId]
        ).catch(() =>
          client.query(
            `INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_main) VALUES ($1, $2, $3, true)`,
            [tenantId, r.rows[0].id, formTeacherId]
          )
        );
      }
    }
    logStep(true, `Inserted ${seed.classes.length} classes`);

    // Teacher-subject-class (all subjects on all classes)
    let tscCount = 0;
    for (const c of seed.classes) {
      for (let si = 0; si < seed.subjects.length; si++) {
        const subj = seed.subjects[si];
        const teacher = seed.teachers.find((t) => t.primary_subject_key === subj.key) || seed.teachers[si % seed.teachers.length];
        await client.query(
          `INSERT INTO teacher_subject_classes (tenant_id, teacher_id, subject_id, class_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, teacher_id, subject_id, class_id) DO NOTHING`,
          [tenantId, ids.get(teacher.key)!, ids.get(subj.key)!, ids.get(c.key)!]
        );
        tscCount++;
      }
    }
    logStep(true, `Inserted ${tscCount} teacher-subject-class links`);

    // Other staff + users
    for (const s of seed.other_staff) {
      const r = await client.query(
        `INSERT INTO other_staff (
           tenant_id, staff_id, full_name, position, phone_number, monthly_salary, employment_status,
           gender, email, date_of_birth, home_address, national_id, employment_type, ssnit_enabled
         ) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,'Full-time',true)
         RETURNING id`,
        [
          tenantId,
          s.staff_id,
          s.full_name,
          s.position,
          s.phone,
          s.monthly_salary,
          s.gender || 'Male',
          s.email || `${s.staff_id.toLowerCase()}@demo.school`,
          s.date_of_birth || '1985-06-01',
          s.home_address || 'Accra, Ghana',
          s.national_id || `GHA-STF-${s.staff_id}`,
        ]
      );
      ids.set(s.key, Number(r.rows[0].id));
      const staffUser = await client.query(
        `INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, other_staff_id, is_active)
         VALUES ($1, $2, $3, $4, $5, 'staff', $6, true)
         RETURNING id`,
        [
          tenantId,
          s.staff_id,
          s.full_name,
          s.email || `${s.staff_id.toLowerCase()}@demo.school`,
          passwordHash,
          r.rows[0].id,
        ]
      );
      ids.set(`user_${s.key}`, Number(staffUser.rows[0].id));
    }
    logStep(true, `Inserted ${seed.other_staff.length} other staff`);

    // Fee structures (Term 1) per class
    const term1Id = ids.get(seed.fee_structure.term_key)!;
    const ayId = ids.get(ay.key)!;
    let tuition = 0;
    let pta = 0;
    let exam = 0;
    for (const item of seed.fee_structure.items) {
      if (item.ledger_field === 'tuition_fee') tuition = item.amount;
      else if (item.ledger_field === 'pta_fee') pta = item.amount;
      else exam += item.amount;
    }
    for (const c of seed.classes) {
      const fsRes = await client.query(
        `INSERT INTO ledger_fee_structures (tenant_id, class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [tenantId, ids.get(c.key)!, ayId, term1Id, tuition, pta, exam, seed.fee_structure.total_per_student]
      );
      const fsId = Number(fsRes.rows[0].id);
      for (const item of seed.fee_structure.items) {
        await client.query(
          `INSERT INTO fee_structure_items (tenant_id, fee_structure_id, item_name, amount, is_active, sort_order)
           VALUES ($1, $2, $3, $4, true, $5)`,
          [tenantId, fsId, item.item_name, item.amount, item.sort_order]
        );
      }
    }
    logStep(true, 'Inserted ledger fee structures + line items for all classes');

    // Students
    const sc = seed.student_config;
    const studentKeys: string[] = [];
    let studentIndex = 0;
    for (const dist of sc.class_distribution) {
      for (let i = 0; i < dist.count; i++) {
        studentIndex++;
        const isFemale = studentIndex % 2 === 0;
        const firstName = isFemale
          ? seed.female_first_names[(studentIndex * 3) % seed.female_first_names.length]
          : seed.male_first_names[(studentIndex * 5) % seed.male_first_names.length];
        const lastName = seed.last_names[(studentIndex * 7) % seed.last_names.length];
        const admissionNumber = `${sc.admission_prefix}${String(studentIndex).padStart(3, '0')}`;
        const studentId = `2024${String(studentIndex).padStart(4, '0')}`;
        const age = 10 + (studentIndex % 7);
        const dob = `${2026 - age}-0${(studentIndex % 9) + 1}-${String((studentIndex % 27) + 1).padStart(2, '0')}`;
        const key = `stu_${String(studentIndex).padStart(3, '0')}`;

        const parentEmail = studentIndex % 4 === 0 ? null : `parent${studentIndex}@demo.school`;
        const spd = seed.student_profile_defaults;
        const siblings = spd
          ? randBetween(spd.number_of_siblings_range[0], spd.number_of_siblings_range[1], studentIndex)
          : studentIndex % 3;
        const rel = spd?.guardian_relationships?.[studentIndex % (spd?.guardian_relationships?.length || 1)] || 'Guardian';
        const r = await client.query(
          `INSERT INTO students (
             tenant_id, first_name, last_name, student_id, admission_number, class_assigned_id,
             date_of_birth, gender, nationality, guardian_name, guardian_contact, guardian_2_name,
             guardian_2_contact, guardian_2_relationship, home_address, number_of_siblings,
             previous_school, date_of_admission, notes, enrollment_status, is_checkin_enabled
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'active',$20)
           RETURNING id`,
          [
            tenantId,
            firstName,
            lastName,
            studentId,
            admissionNumber,
            ids.get(dist.class_key)!,
            dob,
            isFemale ? 'Female' : 'Male',
            spd?.nationality || 'Ghanaian',
            `${rel}. ${lastName}`,
            `+23324${String(1000000 + studentIndex).slice(-7)}`,
            studentIndex % 3 === 0 ? `${isFemale ? 'Mr' : 'Mrs'}. ${lastName} Alt` : null,
            studentIndex % 3 === 0 ? `+23355${String(2000000 + studentIndex).slice(-7)}` : null,
            studentIndex % 3 === 0 ? 'Uncle' : null,
            `${studentIndex} ${spd?.home_address_area || 'Accra'} Street, Ghana`,
            siblings,
            spd?.previous_school || 'Demo Community Basic School',
            spd?.date_of_admission || '2024-09-02',
            parentEmail ? `Parent email: ${parentEmail}` : null,
            studentIndex % 5 === 0,
          ]
        );
        ids.set(key, Number(r.rows[0].id));
        studentKeys.push(key);

        await client.query(
          `INSERT INTO student_class_enrollments (tenant_id, student_id, class_id, academic_year_id, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [tenantId, r.rows[0].id, ids.get(dist.class_key)!, ayId]
        );
      }
    }
    logStep(true, `Inserted ${studentKeys.length} students`);

    // Term fees on ledger
    for (const key of studentKeys) {
      const sid = ids.get(key)!;
      await client.query(
        `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'term_fee')
         ON CONFLICT (tenant_id, student_id, academic_year_id, term_id) WHERE entry_type = 'term_fee'
         DO UPDATE SET debit = EXCLUDED.debit`,
        [tenantId, sid, ayId, term1Id, 'Term 1 Fee', sc.term_fee_total]
      ).catch(() =>
        client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'term_fee')`,
          [tenantId, sid, ayId, term1Id, 'Term 1 Fee', sc.term_fee_total]
        )
      );
    }
    logStep(true, 'Posted term fees to student ledger');

    const term1 = seed.terms.find((t) => t.key === seed.fee_structure.term_key)!;
    const academicTermIdForFinance = ids.get(
      seed.academic_terms.find((t) => t.term_name === activeTerm.name)?.key || 'at_term1'
    )!;
    const recordedByUserIdEarly = primaryAdminId ?? ids.get('user_tch001') ?? null;

    const financeResult = await seedDemoFinance(client, tenantId, seed, ids, studentKeys, sc, {
      ayId,
      term1Id,
      term1Name: term1.name,
      academicYearLabel: ay.name,
      academicTermId: academicTermIdForFinance,
      primaryAdminId,
      recordedByUserId: recordedByUserIdEarly,
    });
    const payCounts = financeResult.payCounts;
    logStep(
      true,
      'Finance: accounts, fees, Paystack, income & expenses',
      `${financeResult.accountIds.size} accounts | ${financeResult.paystackCount} Paystack | ${financeResult.incomeCount} income | ${financeResult.expenseCount} expenses | ${financeResult.transferCount} transfers`
    );
    logStep(true, 'Recorded fee payments', JSON.stringify(payCounts));

    // Grade configuration + assessments (all classes × all subjects × all components + exam)
    const gc = seed.grades_config;
    const gradeCfg = seed.grade_config ?? {
      class_score_weight: 50,
      exam_weight: 50,
      exam_max_marks: 100,
      components: [
        { name: 'Individual Test', weight_in_class_score: 25, max_marks: 20, display_order: 1 },
        { name: 'Group Test', weight_in_class_score: 25, max_marks: 20, display_order: 2 },
        { name: 'Class Test', weight_in_class_score: 25, max_marks: 30, display_order: 3 },
        { name: 'Project', weight_in_class_score: 25, max_marks: 30, display_order: 4 },
      ],
    };
    const componentMap = await seedDemoGradeConfig(client, tenantId, gradeCfg);
    const calculatorConfig = buildCalculatorGradeConfig(gradeCfg, componentMap);
    const termName = activeTerm.name;
    const academicYearLabel = ay.name;
    const academicTermId = ids.get(seed.academic_terms.find((t) => t.term_name === termName)?.key || 'at_term1')!;
    const gradedByUserId = primaryAdminId ?? ids.get('user_tch001') ?? null;
    let reportCards = 0;
    let assessmentCount = 0;

    for (const c of seed.classes) {
      const classId = ids.get(c.key)!;
      const classStudents = studentKeysInClass(studentKeys, sc.class_distribution, c.key);
      const studentAbility = new Map<number, number>();
      for (let si = 0; si < classStudents.length; si++) {
        const stuId = ids.get(classStudents[si])!;
        studentAbility.set(
          stuId,
          targetPercentForStudent(si, classStudents.length, gc, si + classId * 17)
        );
      }

      const subjectResultsByStudent = new Map<
        number,
        Array<{ subject: string; totalPercent: number; gradeLabel: string; remark: string }>
      >();

      for (let subjIdx = 0; subjIdx < seed.subjects.length; subjIdx++) {
        const subj = seed.subjects[subjIdx];
        const subjectId = ids.get(subj.key)!;
        const teacher = teacherForSubject(seed, subj.key, subjIdx);
        const teacherId = ids.get(teacher.key)!;
        const createdBy = ids.get(`user_${teacher.key}`) ?? gradedByUserId;

        const assignmentMeta: Array<{
          id: number;
          componentId: number | null;
          isExam: boolean;
          maxMarks: number;
        }> = [];

        for (const comp of gradeCfg.components) {
          const compInfo = componentMap.get(comp.name)!;
          const assignRes = await client.query(
            `INSERT INTO grade_assignments (
               tenant_id, class_id, subject, subject_id, name, assignment_type,
               max_score, max_marks, term, academic_year, academic_term_id,
               component_id, is_exam, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,false,$12)
             RETURNING id`,
            [
              tenantId,
              classId,
              subj.name,
              subjectId,
              `${subj.name} — ${comp.name}`,
              comp.name,
              comp.max_marks,
              termName,
              academicYearLabel,
              academicTermId,
              compInfo.id,
              createdBy,
            ]
          );
          assignmentMeta.push({
            id: Number(assignRes.rows[0].id),
            componentId: compInfo.id,
            isExam: false,
            maxMarks: comp.max_marks,
          });
          assessmentCount++;
        }

        const examRes = await client.query(
          `INSERT INTO grade_assignments (
             tenant_id, class_id, subject, subject_id, name, assignment_type,
             max_score, max_marks, term, academic_year, academic_term_id,
             component_id, is_exam, created_by
           ) VALUES ($1,$2,$3,$4,$5,'Exam',$6,$6,$7,$8,$9,NULL,true,$10)
           RETURNING id`,
          [
            tenantId,
            classId,
            subj.name,
            subjectId,
            `${subj.name} — End of Term Exam`,
            gradeCfg.exam_max_marks,
            termName,
            academicYearLabel,
            academicTermId,
            createdBy,
          ]
        );
        assignmentMeta.push({
          id: Number(examRes.rows[0].id),
          componentId: null,
          isExam: true,
          maxMarks: gradeCfg.exam_max_marks,
        });
        assessmentCount++;

        const subjectScoresForRanking: { studentId: number; totalPercent: number }[] = [];

        for (let si = 0; si < classStudents.length; si++) {
          const stuKey = classStudents[si];
          const stuId = ids.get(stuKey)!;
          const baseTarget = studentAbility.get(stuId)!;
          const subjectTarget = clamp(
            baseTarget + randBetween(-gc.subject_variance, gc.subject_variance, si + subjIdx * 31 + classId),
            32,
            98
          );

          const assessmentScores: AssessmentScore[] = [];
          for (let ai = 0; ai < assignmentMeta.length; ai++) {
            const meta = assignmentMeta[ai];
            const rawScore = rawScoreForTarget(subjectTarget, meta.maxMarks, stuId + meta.id + ai);
            assessmentScores.push({
              assessmentId: meta.id,
              componentId: meta.componentId,
              isExam: meta.isExam,
              maxMarks: meta.maxMarks,
              rawScore,
            });

            await client.query(
              `INSERT INTO student_grades (tenant_id, student_id, assignment_id, score, raw_score, graded_by)
               VALUES ($1, $2, $3, $4, $4, $5)
               ON CONFLICT (tenant_id, student_id, assignment_id) DO UPDATE SET
                 score = EXCLUDED.score, raw_score = EXCLUDED.raw_score, graded_by = EXCLUDED.graded_by`,
              [tenantId, stuId, meta.id, rawScore, gradedByUserId]
            );
          }

          const result = calculateGrade(assessmentScores, calculatorConfig);
          subjectScoresForRanking.push({ studentId: stuId, totalPercent: result.totalPercent });

          if (!subjectResultsByStudent.has(stuId)) subjectResultsByStudent.set(stuId, []);
          subjectResultsByStudent.get(stuId)!.push({
            subject: subj.name,
            totalPercent: result.totalPercent,
            gradeLabel: result.gradeLabel,
            remark: result.remark,
          });

          await client.query(
            `INSERT INTO term_report_comments (tenant_id, student_id, class_id, term, academic_year, subject, remark_type, remark)
             VALUES ($1, $2, $3, $4, $5, $6, 'subject', $7)
             ON CONFLICT DO NOTHING`,
            [tenantId, stuId, classId, termName, academicYearLabel, subj.name, result.remark]
          ).catch(() => undefined);
        }

      }

      const overallTotals = classStudents.map((stuKey) => {
        const stuId = ids.get(stuKey)!;
        const results = subjectResultsByStudent.get(stuId) || [];
        const totalPercent = results.reduce((sum, r) => sum + r.totalPercent, 0);
        return { studentId: stuId, totalPercent };
      });
      const overallPositions = calculatePositions(overallTotals);

      await client.query(
        `INSERT INTO term_report_releases (tenant_id, class_id, term, is_released, released_at)
         VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, class_id, term) DO UPDATE SET is_released = true, released_at = CURRENT_TIMESTAMP`,
        [tenantId, classId, termName]
      ).catch(() =>
        client.query(
          `INSERT INTO term_report_releases (tenant_id, class_id, term, is_released, released_at)
           VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)`,
          [tenantId, classId, termName]
        )
      );

      const promotedTo = promotedToForClass(c.key);
      const nextTerm = seed.terms.find((t) => t.key === 'term2');
      const reopeningDate = formatReopeningDate(nextTerm?.start_date || '2025-05-05');
      const attendanceOutOf = String(seed.attendance_config?.school_days_back ?? 14);

      for (const stuKey of classStudents) {
        const stuId = ids.get(stuKey)!;
        const stuIdx = parseInt(stuKey.replace('stu_', ''), 10);
        const results = subjectResultsByStudent.get(stuId) || [];
        const grandTotal = results.reduce((sum, r) => sum + r.totalPercent, 0);
        const avgPercent = results.length > 0 ? Math.round((grandTotal / results.length) * 10) / 10 : 0;
        const position = overallPositions.get(stuId) ?? classStudents.length;
        const overallGrade = beceGrade(avgPercent);
        const presentRate = randBetween(
          Math.round((seed.attendance_config?.present_rate_min ?? 0.84) * 100),
          Math.round((seed.attendance_config?.present_rate_max ?? 0.96) * 100),
          stuIdx + classId
        );
        const attendanceDays = Math.max(
          1,
          Math.round((Number(attendanceOutOf) * presentRate) / 100)
        );

        const teacherRemarkBundle = buildDemoTeacherRemarkBundle({
          position,
          classSize: classStudents.length,
          avgPercent,
          overallGrade,
          studentIndex: stuIdx,
          promotedTo,
          reopeningDate,
          attendanceDays,
          attendanceOutOf: Number(attendanceOutOf),
        });

        await client.query(
          `INSERT INTO term_report_comments (tenant_id, student_id, class_id, term, academic_year, subject, remark_type, remark)
           VALUES ($1, $2, $3, $4, $5, $6, 'teacher', $7)
           ON CONFLICT DO NOTHING`,
          [tenantId, stuId, classId, termName, academicYearLabel, TERM_REPORT_REMARK_SUBJECT, teacherRemarkBundle]
        ).catch(() => undefined);

        await client.query(
          `INSERT INTO term_report_comments (tenant_id, student_id, class_id, term, academic_year, subject, remark_type, remark)
           VALUES ($1, $2, $3, $4, $5, NULL, 'headmaster', $6)
           ON CONFLICT DO NOTHING`,
          [
            tenantId,
            stuId,
            classId,
            termName,
            academicYearLabel,
            position <= 3
              ? `Excellent Term 1 performance — ranked ${position} in class. Keep it up!`
              : position <= Math.ceil(classStudents.length * 0.4)
                ? `Good progress this term — ranked ${position} in class. ${remarkFromGrade(overallGrade)} work overall.`
                : `Ranked ${position} in class. More focus on core subjects is recommended next term.`,
          ]
        ).catch(() => undefined);

        await client.query(
          `INSERT INTO report_card_archive (tenant_id, student_id, class_id, academic_year, term, snapshot_json, position, percentage)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
           ON CONFLICT (tenant_id, student_id, term, academic_year) DO UPDATE SET
             snapshot_json = EXCLUDED.snapshot_json,
             position = EXCLUDED.position,
             percentage = EXCLUDED.percentage`,
          [
            tenantId,
            stuId,
            classId,
            academicYearLabel,
            termName,
            JSON.stringify({
              source: 'demo_seed',
              status: 'published',
              is_published: true,
              overallPosition: position,
              averagePercent: avgPercent,
              overallGrade,
              subjects: results,
            }),
            position,
            avgPercent,
          ]
        ).catch(() => undefined);
        reportCards++;
      }
    }
    logStep(
      true,
      `Assessments + grades for all classes/subjects`,
      `${assessmentCount} assessments, ${reportCards} report cards with computed ranks`
    );

    // Timetables for all classes (periods + weekly slots + exam schedule)
    const ttCfg = seed.timetable_config;
    const ttTermId = ids.get(ttCfg?.term_key || seed.grades_config.term_key)!;
    let timetableSlots = 0;
    let examTimetableEntries = 0;

    if (ttCfg) {
      const days = ttCfg.days;
      const subjectRotation = [...seed.subjects];
      let rotationOffset = 0;

      for (let classIdx = 0; classIdx < seed.classes.length; classIdx++) {
        const c = seed.classes[classIdx];
        const classId = ids.get(c.key)!;
        rotationOffset = classIdx * 2;

        const periodIds: Array<{ id: number; isBreak: boolean }> = [];
        for (let pi = 0; pi < ttCfg.periods.length; pi++) {
          const p = ttCfg.periods[pi];
          const periodRes = await client.query(
            `INSERT INTO periods (tenant_id, class_id, term_id, name, start_time, end_time, order_index, is_break)
             VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, $8)
             RETURNING id`,
            [tenantId, classId, ttTermId, p.name, p.start, p.end, pi, p.is_break]
          );
          periodIds.push({ id: Number(periodRes.rows[0].id), isBreak: p.is_break });
        }

        let slotIndex = 0;
        const subjectsPerDay = ttCfg.subjects_per_day ?? 5;
        const teachingPeriods = periodIds.filter((p) => !p.isBreak);

        for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
          const day = days[dayIdx];
          for (let pi = 0; pi < teachingPeriods.length && pi < subjectsPerDay; pi++) {
            const period = teachingPeriods[pi];
            const subj = subjectRotation[(dayIdx * subjectsPerDay + pi + rotationOffset) % subjectRotation.length];
            slotIndex++;
            const teacher = teacherForSubject(seed, subj.key, subjectRotation.indexOf(subj));
            await client.query(
              `INSERT INTO class_timetable (tenant_id, class_id, term_id, day_of_week, period_id, subject_id, teacher_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (tenant_id, class_id, term_id, day_of_week, period_id) DO UPDATE SET
                 subject_id = EXCLUDED.subject_id, teacher_id = EXCLUDED.teacher_id, updated_at = CURRENT_TIMESTAMP`,
              [tenantId, classId, ttTermId, day, period.id, ids.get(subj.key)!, ids.get(teacher.key)!]
            );
            timetableSlots++;
          }
        }

        const termStart = seed.terms.find((t) => t.key === ttCfg.term_key)?.start_date || '2025-01-13';
        for (let si = 0; si < seed.subjects.length; si++) {
          const subj = seed.subjects[si];
          const examDate = new Date(termStart);
          examDate.setDate(examDate.getDate() + 55 + si);
          while (examDate.getDay() === 0 || examDate.getDay() === 6) {
            examDate.setDate(examDate.getDate() + 1);
          }
          const teacher = teacherForSubject(seed, subj.key, si);
          await client.query(
            `INSERT INTO exam_timetable (tenant_id, class_id, term_id, subject_id, exam_date, start_time, end_time, venue, notes)
             VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, $8, $9)`,
            [
              tenantId,
              classId,
              ttTermId,
              ids.get(subj.key)!,
              examDate.toISOString().slice(0, 10),
              '09:00',
              '11:00',
              ttCfg.exam_venue || 'Main Examination Hall',
              `${subj.name} — Term 1 end-of-term examination`,
            ]
          );
          examTimetableEntries++;
        }
      }
      logStep(
        true,
        `Timetables for all classes`,
        `${timetableSlots} class slots, ${examTimetableEntries} exam entries`
      );
    }

    // Payroll (Term 1 — February 2025)
    const pc = seed.payroll_config;
    for (const t of seed.teachers) {
      const gross = roundMoney(t.monthly_salary + pc.transport_allowance + pc.housing_allowance);
      const ssnit = roundMoney(gross * (pc.ssnit_percent / 100));
      const tax = roundMoney(gross * (pc.income_tax_percent / 100));
      const net = roundMoney(gross - ssnit - tax);
      await client.query(
        `INSERT INTO salary_payments (tenant_id, payee_type, payee_id, month, year, amount, gross_salary, ssnit_percent, ssnit_amount, other_deductions, net_salary, paid_date, payment_method, payroll_notes, allowances)
         VALUES ($1, 'teacher', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'bank', 'Demo Term 1 payroll', $12)
         ON CONFLICT (tenant_id, payee_type, payee_id, month, year) DO UPDATE SET amount = EXCLUDED.amount, net_salary = EXCLUDED.net_salary`,
        [
          tenantId,
          ids.get(t.key)!,
          pc.payment_month,
          pc.payment_year,
          net,
          gross,
          pc.ssnit_percent,
          ssnit,
          tax,
          net,
          `${pc.payment_year}-${String(pc.payment_month).padStart(2, '0')}-15`,
          pc.transport_allowance + pc.housing_allowance,
        ]
      );
    }
    for (const s of seed.other_staff) {
      const gross = roundMoney(s.monthly_salary);
      const ssnit = roundMoney(gross * (pc.ssnit_percent / 100));
      const net = roundMoney(gross - ssnit);
      await client.query(
        `INSERT INTO salary_payments (tenant_id, payee_type, payee_id, month, year, amount, gross_salary, ssnit_percent, ssnit_amount, net_salary, paid_date, payment_method, payroll_notes)
         VALUES ($1, 'staff', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'cash', 'Demo Term 1 payroll')
         ON CONFLICT (tenant_id, payee_type, payee_id, month, year) DO UPDATE SET amount = EXCLUDED.amount`,
        [
          tenantId,
          ids.get(s.key)!,
          pc.payment_month,
          pc.payment_year,
          net,
          gross,
          pc.ssnit_percent,
          ssnit,
          net,
          `${pc.payment_year}-${String(pc.payment_month).padStart(2, '0')}-20`,
        ]
      );
    }
    logStep(true, 'Inserted Term 1 payroll for teachers and staff');

    const recordedByUserId = primaryAdminId ?? ids.get('user_tch001') ?? null;
    let attendanceCount = 0;
    let staffClockInCount = 0;
    let chatMessageCount = 0;
    let parentMessageCount = 0;
    let complaintCount = 0;

    // School geolocation settings for staff clock-in
    const sas = seed.school_attendance_settings;
    if (sas) {
      await client.query(
        `INSERT INTO school_attendance_settings (tenant_id, latitude, longitude, radius_meters, school_start_time, school_end_time, late_threshold_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
           radius_meters = EXCLUDED.radius_meters, school_start_time = EXCLUDED.school_start_time,
           school_end_time = EXCLUDED.school_end_time, late_threshold_minutes = EXCLUDED.late_threshold_minutes,
           updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId,
          sas.latitude,
          sas.longitude,
          sas.radius_meters,
          sas.school_start_time,
          sas.school_end_time,
          sas.late_threshold_minutes,
        ]
      ).catch(() => undefined);
    }

    // Student attendance (recent school days)
    const attCfg = seed.attendance_config;
    const attDays = recentWeekdays(attCfg?.school_days_back ?? 14);
    for (const day of attDays) {
      for (const c of seed.classes) {
        const classId = ids.get(c.key)!;
        const classStudents = studentKeys.filter((k) => {
          const idx = parseInt(k.replace('stu_', ''), 10) - 1;
          let offset = 0;
          for (const dist of sc.class_distribution) {
            if (idx < offset + dist.count) return dist.class_key === c.key;
            offset += dist.count;
          }
          return false;
        });
        const presentRate =
          (attCfg?.present_rate_min ?? 0.84) +
          (Math.abs(Math.sin(day.length + classId)) % 1) *
            ((attCfg?.present_rate_max ?? 0.96) - (attCfg?.present_rate_min ?? 0.84));
        for (let si = 0; si < classStudents.length; si++) {
          const stuId = ids.get(classStudents[si])!;
          const present = si / classStudents.length < presentRate;
          await client.query(
            `INSERT INTO attendance (tenant_id, class_id, student_id, attendance_date, present, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (tenant_id, class_id, student_id, attendance_date)
             DO UPDATE SET present = EXCLUDED.present`,
            [tenantId, classId, stuId, day, present, recordedByUserId]
          );
          attendanceCount++;
        }
      }
    }
    logStep(true, `Marked student attendance`, `${attendanceCount} records over ${attDays.length} days`);

    // Staff clock-in / clock-out
    const clkCfg = seed.staff_clock_in_config;
    const clkDays = recentWeekdays(clkCfg?.days_back ?? 12);
    const staffUserIds: number[] = [];
    for (const t of seed.teachers) {
      const uid = ids.get(`user_${t.key}`);
      if (uid) staffUserIds.push(uid);
    }
    for (const s of seed.other_staff) {
      const uid = ids.get(`user_${s.key}`);
      if (uid) staffUserIds.push(uid);
    }
    const lat = sas?.latitude ?? 5.6037;
    const lng = sas?.longitude ?? -0.187;
    for (const day of clkDays) {
      for (let ui = 0; ui < staffUserIds.length; ui++) {
        const uid = staffUserIds[ui];
        const isLate = ui % 10 === 0 || (clkCfg?.late_rate && Math.abs(Math.sin(ui + day.length)) < (clkCfg.late_rate ?? 0.1));
        const checkInTime = isLate ? `${day}T08:05:00+00:00` : `${day}T07:25:00+00:00`;
        const checkOutTime = `${day}T${clkCfg?.school_end || '15:30'}:00+00:00`;
        await client.query(
          `INSERT INTO staff_attendance (
             tenant_id, staff_id, date, check_in_time, check_out_time,
             check_in_latitude, check_in_longitude, is_late, late_reason, check_in_method, checkout_method
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'self','auto')
           ON CONFLICT (tenant_id, staff_id, date) DO UPDATE SET check_out_time = EXCLUDED.check_out_time`,
          [
            tenantId,
            uid,
            day,
            checkInTime,
            checkOutTime,
            lat,
            lng,
            isLate,
            isLate ? clkCfg?.late_reasons?.[ui % (clkCfg?.late_reasons?.length || 1)] ?? 'Traffic delay' : null,
          ]
        ).catch(() => undefined);
        staffClockInCount++;
      }
    }
    logStep(true, `Recorded staff clock-in/out`, `${staffClockInCount} records`);

    // Parent portal accounts + parent desk messages
    const ppc = seed.parent_portal_config;
    const portalN = ppc?.create_for_first_n_students ?? 40;
    const parentAccountByStudent: Map<number, number> = new Map();
    for (let i = 0; i < Math.min(portalN, studentKeys.length); i++) {
      const stuKey = studentKeys[i];
      const stuId = ids.get(stuKey)!;
      const idx = i + 1;
      const admissionNumber = `${sc.admission_prefix}${String(idx).padStart(3, '0')}`;
      const portalPass = ppc?.password_uses_admission_number ? admissionNumber : `parent${idx}`;
      const portalHash = await hashPassword(portalPass);
      const pa = await client.query(
        `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password, is_active)
         VALUES ($1,$2,$3,false,true)
         ON CONFLICT (tenant_id, student_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [tenantId, stuId, portalHash]
      );
      parentAccountByStudent.set(stuId, Number(pa.rows[0].id));
    }
    logStep(true, `Created parent portal accounts`, `${parentAccountByStudent.size}`);

    for (const pm of seed.parent_messages_seed || []) {
      const stuKey = `stu_${String(pm.student_index).padStart(3, '0')}`;
      const stuId = ids.get(stuKey);
      if (!stuId) continue;
      let parentAccountId = parentAccountByStudent.get(stuId);
      if (!parentAccountId) {
        const portalHash = await hashPassword(`${sc.admission_prefix}${String(pm.student_index).padStart(3, '0')}`);
        const pa = await client.query(
          `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password, is_active)
           VALUES ($1,$2,$3,false,true)
           ON CONFLICT (tenant_id, student_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
           RETURNING id`,
          [tenantId, stuId, portalHash]
        );
        parentAccountId = Number(pa.rows[0].id);
      }
      const msgType = pm.type === 'inquiry' ? 'fee' : pm.type;
      await client.query(
        `INSERT INTO parent_messages (tenant_id, parent_account_id, student_id, type, subject, message, status, is_read_by_school, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
        [
          tenantId,
          parentAccountId,
          stuId,
          msgType,
          pm.subject,
          pm.message,
          pm.status,
          pm.is_read_by_school,
          daysAgoTimestamp(pm.days_ago, '10:30:00'),
        ]
      );
      parentMessageCount++;
    }
    logStep(true, `Inserted parent desk messages`, `${parentMessageCount}`);

    // Complaints
    for (const c of seed.complaints_seed || []) {
      const filedBy = ids.get(`user_${c.filed_by_teacher_key}`);
      if (!filedBy) continue;
      let subjectStudentId: number | null = null;
      let subjectTeacherUserId: number | null = null;
      if (c.complaint_type === 'student' && c.subject_student_index) {
        subjectStudentId = ids.get(`stu_${String(c.subject_student_index).padStart(3, '0')}`) ?? null;
      }
      if (c.complaint_type === 'teacher' && c.subject_teacher_key) {
        subjectTeacherUserId = ids.get(`user_${c.subject_teacher_key}`) ?? null;
      }
      const createdAt = daysAgoTimestamp(c.days_ago ?? 0, '14:00:00');
      const resolvedAt = c.status === 'resolved' ? daysAgoTimestamp(Math.max(0, (c.days_ago ?? 0) - 1), '16:00:00') : null;
      const ins = await client.query(
        `INSERT INTO complaints (
           tenant_id, complaint_type, filed_by, subject_student_id, subject_teacher_id,
           title, description, severity, is_anonymous, status, resolution_note, resolved_by, resolved_at, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz)
         RETURNING id`,
        [
          tenantId,
          c.complaint_type,
          filedBy,
          subjectStudentId,
          subjectTeacherUserId,
          c.title,
          c.description,
          c.severity,
          c.is_anonymous ?? false,
          c.status,
          c.resolution_note ?? null,
          c.status === 'resolved' ? primaryAdminId : null,
          resolvedAt,
          createdAt,
        ]
      );
      await client.query(
        `INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status, note, created_at)
         VALUES ($1,$2,NULL,$3,$4,$5::timestamptz)`,
        [ins.rows[0].id, filedBy, c.status, 'Demo seed status', createdAt]
      ).catch(() => undefined);
      complaintCount++;
    }
    logStep(true, `Filed demo complaints`, `${complaintCount}`);

    // Realistic profile photos (human faces)
    const profilePhotoCount = await seedDemoProfilePhotos(client, tenantId, seed, ids, studentKeys, sc);
    logStep(true, `Applied demo profile photos`, `${profilePhotoCount} portraits`);

    const tenantNameRes = await client.query(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
    const schoolName = String(tenantNameRes.rows[0]?.name || 'Our School');
    const websiteResult = await seedDemoWebsiteContent(client, tenantId, seed, ids, {
      studentCount: studentKeys.length,
      classCount: seed.classes.length,
      schoolName,
    });
    logStep(
      true,
      'Seeded public school website',
      `${websiteResult.gallery} gallery · ${websiteResult.events} events · ${websiteResult.teamMembers} team`
    );

    // Ensure active term/year match seeded assessments (Grades module reads these)
    await client.query(
      `UPDATE school_settings
       SET current_year = $2, current_term = $3, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1`,
      [tenantId, ay.name, activeTerm.name]
    );
    await client.query(
      `UPDATE academic_terms SET is_active = (term_name = $2 AND year = $3)
       WHERE tenant_id = $1`,
      [tenantId, activeTerm.name, ay.name]
    );

    const assessCheck = await client.query(
      `SELECT COUNT(*)::int AS n FROM grade_assignments WHERE tenant_id = $1 AND term = $2 AND academic_year = $3`,
      [tenantId, activeTerm.name, ay.name]
    );
    const expectedAssessments = seed.classes.length * seed.subjects.length * (gradeCfg.components.length + 1);
    const actualAssessments = Number(assessCheck.rows[0]?.n ?? 0);
    if (actualAssessments < expectedAssessments) {
      throw new Error(
        `Demo assessments incomplete: expected ${expectedAssessments}, found ${actualAssessments}. Check grade import.`
      );
    }
    logStep(true, 'Verified assessments for active term', `${actualAssessments} rows`);

    await client.query(`UPDATE tenants SET is_demo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      tenantId,
    ]);
    logStep(true, 'Marked tenant as demo environment');

    await client.query('COMMIT');

    // Chat (post-commit — bootstrap reads committed users)
    await bootstrapTenantChat(tenantId);
    for (const ch of seed.chat_seed?.channels || []) {
      const chRes = await query(
        `SELECT id FROM chat_channels WHERE tenant_id = $1 AND channel_type = $2 LIMIT 1`,
        [tenantId, ch.channel_type]
      );
      const channelId = chRes.rows[0]?.id;
      if (!channelId) continue;
      for (const msg of ch.messages) {
        const senderId = msg.sender_teacher_key
          ? ids.get(`user_${msg.sender_teacher_key}`)
          : msg.sender_staff_key
            ? ids.get(`user_${msg.sender_staff_key}`)
            : recordedByUserId;
        if (!senderId) continue;
        await query(
          `INSERT INTO chat_messages (channel_id, tenant_id, sender_id, message, created_at)
           VALUES ($1,$2,$3,$4,$5::timestamptz)`,
          [channelId, tenantId, senderId, msg.text, daysAgoTimestamp(msg.days_ago, '09:00:00')]
        );
        chatMessageCount++;
      }
    }
    logStep(true, `Seeded in-app chat messages`, `${chatMessageCount}`);

    const summary: DemoImportSummary = {
      tenantId,
      slug,
      students: studentKeys.length,
      teachers: seed.teachers.length,
      otherStaff: seed.other_staff.length,
      payments: payCounts,
      reportCardsPublished: reportCards,
      assessments: assessmentCount,
      timetableSlots,
      examTimetableEntries,
      profilePhotos: profilePhotoCount,
      attendanceRecords: attendanceCount,
      staffClockIns: staffClockInCount,
      chatMessages: chatMessageCount,
      parentMessages: parentMessageCount,
      complaints: complaintCount,
      paymentAccounts: financeResult.accountIds.size,
      incomeEntries: financeResult.incomeCount,
      expenseEntries: financeResult.expenseCount,
      paystackPayments: financeResult.paystackCount,
      fundTransfers: financeResult.transferCount,
      websiteGallery: websiteResult.gallery,
      websiteEvents: websiteResult.events,
      websiteTeam: websiteResult.teamMembers,
    };

    const payWindowDays = seed.payment_config?.window_days ?? 30;
    console.log(`\n✅ Demo data loaded for tenant ${slug}`);
    console.log(`👨‍🎓 ${summary.students} students across ${seed.classes.length} classes`);
    console.log(`👩‍🏫 ${summary.teachers} teachers + ${summary.otherStaff} staff`);
    console.log(
      `💰 Fee payments: ${payCounts.full_paid} paid, ${payCounts.partial} partial, ${payCounts.unpaid} unpaid, ${payCounts.overpaid} credit (last ${payWindowDays} days)`
    );
    console.log(
      `🏦 Cash & Bank: ${financeResult.accountIds.size} accounts | ${financeResult.paystackCount} Paystack | ${financeResult.incomeCount} income | ${financeResult.expenseCount} expenses | ${financeResult.transferCount} transfers`
    );
    console.log(`📝 Assessments: ${assessmentCount} (all subjects × components + exams)`);
    console.log(`📋 Report cards: ${reportCards} with computed class ranks`);
    console.log(`🗓️ Timetable: ${timetableSlots} slots + ${examTimetableEntries} exam entries`);
    console.log(`🖼️ Profile photos: ${profilePhotoCount} students/teachers/staff`);
    console.log(`📅 Attendance: ${attendanceCount} marks | Staff clock-ins: ${staffClockInCount}`);
    console.log(`💬 Chat: ${chatMessageCount} messages | Parent desk: ${parentMessageCount} | Complaints: ${complaintCount}`);
    console.log(
      `🌐 Website: ${websiteResult.gallery} gallery photos · ${websiteResult.events} events · ${websiteResult.teamMembers} team (published & enabled)`
    );

    return summary;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    const msg = (err as Error).message || String(err);
    logStep(false, 'Demo import failed', msg);
    throw err;
  } finally {
    client.release();
  }
}
