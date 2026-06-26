import { query } from '../db/connection.js';
import { sendPushToStudentParents, sendPushToStaffUser, sendPushToTenantStaff } from './webPushService.js';

export interface BirthdayPerson {
  id: number;
  fullName: string;
  type: 'student' | 'teacher';
  dateOfBirth: string;
  age: number;
  classId?: number | null;
  className?: string | null;
  classTeacherName?: string | null;
  photoUrl?: string | null;
}

export interface BirthdayGroup {
  date: string;
  dayLabel: string;
  people: BirthdayPerson[];
}

export interface BirthdayMessageConfig {
  studentParentTitle: string;
  studentParentMessage: string;
  classTeacherTitle: string;
  classTeacherMessage: string;
  teacherStaffTitle: string;
  teacherStaffMessage: string;
}

export const DEFAULT_BIRTHDAY_MESSAGE_CONFIG: BirthdayMessageConfig = {
  studentParentTitle: 'Happy Birthday!',
  studentParentMessage: '{{name}} is turning {{age}} today! Wish them a wonderful birthday!',
  classTeacherTitle: 'Student Birthday!',
  classTeacherMessage: '{{name}} ({{class}}) is turning {{age}} today!',
  teacherStaffTitle: 'Staff Birthday!',
  teacherStaffMessage: '{{name}} is turning {{age}} today! Wish them a wonderful day!',
};

function mergeBirthdayConfig(raw: unknown): BirthdayMessageConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof BirthdayMessageConfig, fallback: string) => {
    const v = src[key];
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  };
  return {
    studentParentTitle: pick('studentParentTitle', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.studentParentTitle),
    studentParentMessage: pick('studentParentMessage', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.studentParentMessage),
    classTeacherTitle: pick('classTeacherTitle', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.classTeacherTitle),
    classTeacherMessage: pick('classTeacherMessage', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.classTeacherMessage),
    teacherStaffTitle: pick('teacherStaffTitle', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.teacherStaffTitle),
    teacherStaffMessage: pick('teacherStaffMessage', DEFAULT_BIRTHDAY_MESSAGE_CONFIG.teacherStaffMessage),
  };
}

export function renderBirthdayTemplate(
  template: string,
  vars: { name: string; age: number; className?: string | null }
): string {
  return String(template || '')
    .replace(/\{\{name\}\}/gi, vars.name)
    .replace(/\{\{age\}\}/gi, String(vars.age))
    .replace(/\{\{class\}\}/gi, vars.className?.trim() || '');
}

export async function getBirthdayMessageConfig(tenantId: number): Promise<BirthdayMessageConfig> {
  const res = await query(
    `SELECT birthday_message_config FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (res.rows.length === 0) return { ...DEFAULT_BIRTHDAY_MESSAGE_CONFIG };
  return mergeBirthdayConfig(res.rows[0].birthday_message_config);
}

export async function saveBirthdayMessageConfig(
  tenantId: number,
  updates: Partial<BirthdayMessageConfig>
): Promise<BirthdayMessageConfig> {
  const current = await getBirthdayMessageConfig(tenantId);
  const next = mergeBirthdayConfig({ ...current, ...updates });
  await query(
    `INSERT INTO school_settings (tenant_id, school_name, birthday_message_config)
     SELECT $1, COALESCE(t.name, 'School'), $2::jsonb
     FROM tenants t WHERE t.id = $1
     ON CONFLICT (tenant_id) DO UPDATE
       SET birthday_message_config = EXCLUDED.birthday_message_config,
           updated_at = CURRENT_TIMESTAMP`,
    [tenantId, JSON.stringify(next)]
  );
  return next;
}

function birthdayAge(birthDate: string): number {
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getFullYear() - bd.getFullYear();
  const monthDiff = today.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
    age--;
  }
  return age;
}

function ageOnBirthday(birthDate: string, birthdayYear: number): number {
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return birthdayAge(birthDate);
  return birthdayYear - bd.getFullYear();
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function monthDaySQL(col: string): { month: string; day: string } {
  return {
    month: `EXTRACT(MONTH FROM ${col}::date)`,
    day: `EXTRACT(DAY FROM ${col}::date)`,
  };
}

export async function getBirthdaysToday(tenantId: number): Promise<BirthdayPerson[]> {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const studentsRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) = $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, currentMonth, currentDay]
  );

  const teachersRes = await query(
    `SELECT t.id, t.full_name, t.date_of_birth, t.passport_photo_url,
            c.class_name
     FROM teachers t
     LEFT JOIN classes c ON c.id = t.class_assigned_id AND c.tenant_id = t.tenant_id
     WHERE t.tenant_id = $1
       AND t.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM t.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM t.date_of_birth::date) = $3
       AND (t.status IS NULL OR t.status = 'active')`,
    [tenantId, currentMonth, currentDay]
  );

  const results: BirthdayPerson[] = [];

  for (const row of studentsRes.rows) {
    results.push({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`,
      type: 'student',
      dateOfBirth: row.date_of_birth,
      age: birthdayAge(row.date_of_birth),
      classId: row.class_assigned_id,
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
    });
  }

  for (const row of teachersRes.rows) {
    results.push({
      id: row.id,
      fullName: row.full_name,
      type: 'teacher',
      dateOfBirth: row.date_of_birth,
      age: birthdayAge(row.date_of_birth),
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
    });
  }

  return results;
}

export async function getBirthdaysForMonth(
  tenantId: number,
  year: number,
  month: number,
  options?: { fromDay?: number }
): Promise<BirthdayGroup[]> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fromDay = options?.fromDay ?? 1;

  const studentsRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            EXTRACT(DAY FROM s.date_of_birth::date)::int AS birth_day,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) >= $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, month, fromDay]
  );

  const teachersRes = await query(
    `SELECT t.id, t.full_name, t.date_of_birth, t.passport_photo_url,
            EXTRACT(DAY FROM t.date_of_birth::date)::int AS birth_day,
            c.class_name
     FROM teachers t
     LEFT JOIN classes c ON c.id = t.class_assigned_id AND c.tenant_id = t.tenant_id
     WHERE t.tenant_id = $1
       AND t.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM t.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM t.date_of_birth::date) >= $3
       AND (t.status IS NULL OR t.status = 'active')`,
    [tenantId, month, fromDay]
  );

  const people: Array<BirthdayPerson & { day: number }> = [];

  for (const row of studentsRes.rows) {
    const day = Number(row.birth_day);
    people.push({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`,
      type: 'student',
      dateOfBirth: row.date_of_birth,
      age: ageOnBirthday(row.date_of_birth, year),
      classId: row.class_assigned_id,
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
      day,
    });
  }

  for (const row of teachersRes.rows) {
    const day = Number(row.birth_day);
    people.push({
      id: row.id,
      fullName: row.full_name,
      type: 'teacher',
      dateOfBirth: row.date_of_birth,
      age: ageOnBirthday(row.date_of_birth, year),
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
      day,
    });
  }

  people.sort((a, b) => a.day - b.day);

  const groups: Record<string, BirthdayPerson[]> = {};
  for (const item of people) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
    if (!groups[dateStr]) groups[dateStr] = [];
    const { day, ...person } = item;
    groups[dateStr].push(person);
  }

  return Object.entries(groups).map(([date, groupPeople]) => {
    const d = new Date(date + 'T12:00:00');
    return { date, dayLabel: dayNames[d.getDay()], people: groupPeople };
  });
}

export async function getBirthdaysByMonthSections(tenantId: number): Promise<{
  label: string;
  year: number;
  month: number;
  groups: BirthdayGroup[];
}> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const groups = await getBirthdaysForMonth(tenantId, currentYear, currentMonth, { fromDay: 1 });

  return {
    label: monthLabel(currentYear, currentMonth),
    year: currentYear,
    month: currentMonth,
    groups,
  };
}

export async function getUpcomingBirthdays(
  tenantId: number,
  days: number = 30
): Promise<BirthdayGroup[]> {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const studentsRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.date_of_birth IS NOT NULL
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId]
  );

  const teachersRes = await query(
    `SELECT t.id, t.full_name, t.date_of_birth, t.passport_photo_url,
            c.class_name
     FROM teachers t
     LEFT JOIN classes c ON c.id = t.class_assigned_id AND c.tenant_id = t.tenant_id
     WHERE t.tenant_id = $1
       AND t.date_of_birth IS NOT NULL
       AND (t.status IS NULL OR t.status = 'active')`,
    [tenantId]
  );

  const upcomingBirthdays: Array<BirthdayPerson & { nextDate: Date }> = [];

  function getNextBirthday(dateOfBirth: string): Date | null {
    const bd = new Date(dateOfBirth);
    if (isNaN(bd.getTime())) return null;
    const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (thisYear >= today) return thisYear;
    return new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
  }

  function isWithinDays(d: Date, n: number): boolean {
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= n;
  }

  function addIfUpcoming(person: BirthdayPerson) {
    const next = getNextBirthday(person.dateOfBirth);
    if (next && isWithinDays(next, days)) {
      upcomingBirthdays.push({ ...person, nextDate: next });
    }
  }

  for (const row of studentsRes.rows) {
    addIfUpcoming({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`,
      type: 'student',
      dateOfBirth: row.date_of_birth,
      age: birthdayAge(row.date_of_birth),
      classId: row.class_assigned_id,
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
    });
  }

  for (const row of teachersRes.rows) {
    addIfUpcoming({
      id: row.id,
      fullName: row.full_name,
      type: 'teacher',
      dateOfBirth: row.date_of_birth,
      age: birthdayAge(row.date_of_birth),
      className: row.class_name || null,
      photoUrl: row.passport_photo_url || null,
    });
  }

  upcomingBirthdays.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  const groups: Record<string, BirthdayPerson[]> = {};
  for (const item of upcomingBirthdays) {
    const dateStr = item.nextDate.toISOString().slice(0, 10);
    if (!groups[dateStr]) groups[dateStr] = [];
    const { nextDate, ...person } = item;
    groups[dateStr].push(person);
  }

  return Object.entries(groups).map(([date, people]) => {
    const d = new Date(date + 'T12:00:00');
    return { date, dayLabel: dayNames[d.getDay()], people };
  });
}

export async function getClassBirthdaysToday(
  tenantId: number,
  classId: number
): Promise<BirthdayPerson[]> {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const res = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.class_assigned_id = $2
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $3
       AND EXTRACT(DAY FROM s.date_of_birth::date) = $4
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, classId, currentMonth, currentDay]
  );

  return res.rows.map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
    type: 'student' as const,
    dateOfBirth: row.date_of_birth,
    age: birthdayAge(row.date_of_birth),
    classId: row.class_assigned_id,
    className: row.class_name || null,
    photoUrl: row.passport_photo_url || null,
  }));
}

export async function getStudentBirthdaysForParent(
  tenantId: number,
  studentIds: number[]
): Promise<BirthdayPerson[]> {
  if (studentIds.length === 0) return [];

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const res = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.id = ANY($4::int[])
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) = $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, currentMonth, currentDay, studentIds]
  );

  return res.rows.map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
    type: 'student' as const,
    dateOfBirth: row.date_of_birth,
    age: birthdayAge(row.date_of_birth),
    classId: row.class_assigned_id,
    className: row.class_name || null,
    photoUrl: row.passport_photo_url || null,
  }));
}

export async function getTeacherAssignedClassIds(
  tenantId: number,
  teacherId: number
): Promise<number[]> {
  const baseUnion = `
    SELECT ct.class_id
    FROM class_teachers ct
    WHERE ct.tenant_id = $1 AND ct.teacher_id = $2
    UNION
    SELECT t.class_assigned_id AS class_id
    FROM teachers t
    WHERE t.tenant_id = $1 AND t.id = $2 AND t.class_assigned_id IS NOT NULL
  `;

  try {
    const res = await query(
      `SELECT DISTINCT class_id FROM (
         ${baseUnion}
         UNION
         SELECT tsc.class_id
         FROM teacher_subject_classes tsc
         WHERE tsc.tenant_id = $1 AND tsc.teacher_id = $2
       ) AS all_classes
       WHERE class_id IS NOT NULL`,
      [tenantId, teacherId]
    );
    return res.rows.map((r) => Number(r.class_id));
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code !== '42P01') throw e;
    const res = await query(
      `SELECT DISTINCT class_id FROM (
         ${baseUnion}
       ) AS all_classes
       WHERE class_id IS NOT NULL`,
      [tenantId, teacherId]
    );
    return res.rows.map((r) => Number(r.class_id));
  }
}

function mapStudentBirthdayRow(row: {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  class_assigned_id?: number | null;
  class_name?: string | null;
  passport_photo_url?: string | null;
}): BirthdayPerson {
  return {
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
    type: 'student',
    dateOfBirth: row.date_of_birth,
    age: birthdayAge(row.date_of_birth),
    classId: row.class_assigned_id ?? null,
    className: row.class_name || null,
    photoUrl: row.passport_photo_url || null,
  };
}

export async function getStudentBirthdaysTodayForClasses(
  tenantId: number,
  classIds: number[]
): Promise<BirthdayPerson[]> {
  if (classIds.length === 0) return [];

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const res = await query(
    `SELECT DISTINCT ON (s.id) s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.class_assigned_id = ANY($4::int[])
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) = $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')
     ORDER BY s.id`,
    [tenantId, currentMonth, currentDay, classIds]
  );

  return res.rows.map(mapStudentBirthdayRow);
}

export async function getMyClassesBirthdaysToday(
  tenantId: number,
  teacherId: number
): Promise<BirthdayPerson[]> {
  const classIds = await getTeacherAssignedClassIds(tenantId, teacherId);
  return getStudentBirthdaysTodayForClasses(tenantId, classIds);
}

export async function getBirthdaysForMonthForClasses(
  tenantId: number,
  year: number,
  month: number,
  classIds: number[],
  options?: { fromDay?: number }
): Promise<BirthdayGroup[]> {
  if (classIds.length === 0) return [];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fromDay = options?.fromDay ?? 1;

  const studentsRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            EXTRACT(DAY FROM s.date_of_birth::date)::int AS birth_day,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.class_assigned_id = ANY($4::int[])
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) >= $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, month, fromDay, classIds]
  );

  const people: Array<BirthdayPerson & { day: number }> = studentsRes.rows.map((row) => ({
    ...mapStudentBirthdayRow(row),
    age: ageOnBirthday(row.date_of_birth, year),
    day: Number(row.birth_day),
  }));

  people.sort((a, b) => a.day - b.day);

  const groups: Record<string, BirthdayPerson[]> = {};
  for (const item of people) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
    if (!groups[dateStr]) groups[dateStr] = [];
    const { day, ...person } = item;
    groups[dateStr].push(person);
  }

  return Object.entries(groups).map(([date, groupPeople]) => {
    const d = new Date(date + 'T12:00:00');
    return { date, dayLabel: dayNames[d.getDay()], people: groupPeople };
  });
}

export async function getTeacherClassesBirthdaysByMonthSections(
  tenantId: number,
  teacherId: number
): Promise<{
  label: string;
  year: number;
  month: number;
  groups: BirthdayGroup[];
}> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const classIds = await getTeacherAssignedClassIds(tenantId, teacherId);
  const groups = await getBirthdaysForMonthForClasses(
    tenantId,
    currentYear,
    currentMonth,
    classIds,
    { fromDay: 1 }
  );

  return {
    label: monthLabel(currentYear, currentMonth),
    year: currentYear,
    month: currentMonth,
    groups,
  };
}

/** Returns true only the first time a birthday wish is claimed for this person on this date. */
async function claimBirthdayWish(
  tenantId: number,
  personType: 'student' | 'teacher',
  personId: number
): Promise<boolean> {
  const res = await query(
    `INSERT INTO birthday_wishes_sent (tenant_id, person_type, person_id, wish_date)
     VALUES ($1, $2, $3, CURRENT_DATE)
     ON CONFLICT (tenant_id, person_type, person_id, wish_date) DO NOTHING
     RETURNING id`,
    [tenantId, personType, personId]
  );
  return res.rows.length > 0;
}

export async function sendBirthdayNotifications(
  tenantId: number,
  birthdayPeople: BirthdayPerson[]
) {
  const config = await getBirthdayMessageConfig(tenantId);
  const students = birthdayPeople.filter((p) => p.type === 'student');
  const teachers = birthdayPeople.filter((p) => p.type === 'teacher');

  for (const person of students) {
    const shouldSend = await claimBirthdayWish(tenantId, 'student', person.id);
    if (!shouldSend) continue;

    const parentBody = renderBirthdayTemplate(config.studentParentMessage, {
      name: person.fullName,
      age: person.age,
      className: person.className,
    });

    await sendPushToStudentParents(tenantId, person.id, {
      title: config.studentParentTitle,
      body: parentBody,
      url: '/parent-portal',
      icon: 'cake',
    }).catch(() => {});

    if (person.classId) {
      const teacherUserIds = await getClassTeacherUserIds(tenantId, person.classId);
      const classBody = renderBirthdayTemplate(config.classTeacherMessage, {
        name: person.fullName,
        age: person.age,
        className: person.className,
      });
      for (const userId of teacherUserIds) {
        await sendPushToStaffUser(userId, {
          title: config.classTeacherTitle,
          body: classBody,
          url: '/',
        }).catch(() => {});
      }
    }
  }

  for (const person of teachers) {
    const shouldSend = await claimBirthdayWish(tenantId, 'teacher', person.id);
    if (!shouldSend) continue;

    const staffBody = renderBirthdayTemplate(config.teacherStaffMessage, {
      name: person.fullName,
      age: person.age,
      className: person.className,
    });

    await sendPushToTenantStaff(tenantId, {
      title: config.teacherStaffTitle,
      body: staffBody,
      url: '/',
    }).catch(() => {});
  }
}

async function getClassTeacherUserIds(tenantId: number, classId: number): Promise<number[]> {
  const res = await query(
    `SELECT DISTINCT u.id
     FROM class_teachers ct
     JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
     JOIN users u ON u.teacher_id::text = t.id::text AND u.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = $1 AND ct.class_id = $2 AND u.is_active = true`,
    [tenantId, classId]
  );
  return res.rows.map((r) => r.id);
}
