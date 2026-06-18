import { query } from '../db/connection.js';

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

  const placeholders = studentIds.map((_, i) => `$${i + 5}`).join(',');
  const res = await query(
    `SELECT s.id, s.first_name, s.last_name, s.date_of_birth,
            s.class_assigned_id, s.passport_photo_url,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND s.id IN (${placeholders})
       AND s.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM s.date_of_birth::date) = $2
       AND EXTRACT(DAY FROM s.date_of_birth::date) = $3
       AND (s.enrollment_status IS NULL OR s.enrollment_status = 'active')`,
    [tenantId, currentMonth, currentDay, ...studentIds]
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

export async function getClassTeacherIds(
  tenantId: number,
  teacherId: number
): Promise<number[]> {
  const res = await query(
    `SELECT class_id FROM class_teachers WHERE tenant_id = $1 AND teacher_id = $2`,
    [tenantId, teacherId]
  );
  return res.rows.map((r) => r.class_id);
}

export async function sendBirthdayNotifications(
  tenantId: number,
  birthdayPeople: BirthdayPerson[]
) {
  for (const person of birthdayPeople) {
    if (person.type !== 'student') continue;

    const guardianRes = await query(
      `SELECT s.guardian_name, s.guardian_contact
       FROM students s
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [person.id, tenantId]
    );

    const guardianName = guardianRes.rows[0]?.guardian_name || 'Parent/Guardian';

    const parentAccountsRes = await query(
      `SELECT ppa.id
       FROM parent_portal_accounts ppa
       WHERE ppa.student_id = $1 AND ppa.tenant_id = $2 AND ppa.is_active = true`,
      [person.id, tenantId]
    );

    for (const account of parentAccountsRes.rows) {
      const existing = await query(
        `SELECT id FROM parent_notifications
         WHERE parent_account_id = $1
           AND tenant_id = $2
           AND title = 'Happy Birthday!'
           AND created_at::date = CURRENT_DATE`,
        [account.id, tenantId]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, icon, url)
           VALUES ($1, $2, 'Happy Birthday!', $3, 'cake', '/parent-portal')`,
          [
            tenantId,
            account.id,
            `🎉 ${person.fullName} is turning ${person.age} today! Wish them a wonderful birthday!`,
          ]
        );
      }
    }
  }
}
