import { query } from '../db/connection.js';

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];

export type PeriodRow = {
  id: number;
  tenant_id: number;
  class_id: number | null;
  term_id: number | null;
  name: string;
  start_time: string;
  end_time: string;
  order_index: number;
  is_break: boolean;
};

export type ClassSlotRow = {
  id: number;
  tenant_id: number;
  class_id: number;
  term_id: number;
  day_of_week: TimetableDay;
  period_id: number;
  subject_id: number;
  teacher_id: number | null;
  subject_name?: string;
  teacher_name?: string;
  class_name?: string;
  period_name?: string;
  start_time?: string;
  end_time?: string;
};

export type ExamRow = {
  id: number;
  tenant_id: number;
  class_id: number;
  term_id: number;
  subject_id: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  notes: string | null;
  subject_name?: string;
  class_name?: string;
  teacher_name?: string;
};

export type TeacherConflict = {
  teacher_id: number;
  teacher_name: string;
  class_id: number;
  class_name: string;
  day_of_week: TimetableDay;
  period_id: number;
};

function parseDay(value: unknown): TimetableDay | null {
  const day = String(value || '').trim();
  return (TIMETABLE_DAYS as readonly string[]).includes(day) ? (day as TimetableDay) : null;
}

function parseTime(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw.length === 5 ? `${raw}:00` : raw;
  return null;
}

export async function assertTermBelongsToTenant(tenantId: number, termId: number): Promise<void> {
  const res = await query(`SELECT id FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [termId, tenantId]);
  if (res.rows.length === 0) throw new Error('Term not found');
}

export async function assertClassBelongsToTenant(tenantId: number, classId: number): Promise<void> {
  const res = await query(`SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [classId, tenantId]);
  if (res.rows.length === 0) throw new Error('Class not found');
}

export async function assertSubjectBelongsToTenant(tenantId: number, subjectId: number): Promise<void> {
  const res = await query(`SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [subjectId, tenantId]);
  if (res.rows.length === 0) throw new Error('Subject not found');
}

export async function assertPeriodBelongsToTenant(tenantId: number, periodId: number): Promise<void> {
  const res = await query(`SELECT id FROM periods WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [periodId, tenantId]);
  if (res.rows.length === 0) throw new Error('Period not found');
}

async function assertPeriodAllowsSlots(tenantId: number, periodId: number): Promise<void> {
  const res = await query(
    `SELECT COALESCE(is_break, false) AS is_break FROM periods WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [periodId, tenantId]
  );
  if (res.rows.length === 0) throw new Error('Period not found');
  if (Boolean(res.rows[0].is_break)) throw new Error('Cannot assign subjects to a break period');
}

export async function listPeriods(
  tenantId: number,
  scope?: { class_id: number; term_id: number }
): Promise<PeriodRow[]> {
  if (scope) {
    return listPeriodsForClassTerm(tenantId, scope.class_id, scope.term_id);
  }
  const res = await query(
    `SELECT id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, COALESCE(is_break, false) AS is_break
       FROM periods
      WHERE tenant_id = $1
      ORDER BY order_index ASC, start_time ASC, id ASC`,
    [tenantId]
  );
  return res.rows as PeriodRow[];
}

export async function listPeriodsForClassTerm(
  tenantId: number,
  classId: number,
  termId: number
): Promise<PeriodRow[]> {
  const res = await query(
    `SELECT id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, COALESCE(is_break, false) AS is_break
       FROM periods
      WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3
      ORDER BY order_index ASC, start_time ASC, id ASC`,
    [tenantId, classId, termId]
  );
  return res.rows as PeriodRow[];
}

async function listLegacyGlobalPeriods(tenantId: number): Promise<PeriodRow[]> {
  const res = await query(
    `SELECT id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, COALESCE(is_break, false) AS is_break
       FROM periods
      WHERE tenant_id = $1 AND class_id IS NULL AND term_id IS NULL
      ORDER BY order_index ASC, start_time ASC, id ASC`,
    [tenantId]
  );
  return res.rows as PeriodRow[];
}

async function bootstrapPeriodsForClassTerm(
  tenantId: number,
  classId: number,
  termId: number,
  minCount: number
): Promise<PeriodRow[]> {
  const legacy = await listLegacyGlobalPeriods(tenantId);
  const template =
    legacy.length > 0
      ? legacy
      : Array.from({ length: minCount }, (_, index) => {
          const slot = defaultPeriodWindow(index);
          return {
            id: 0,
            tenant_id: tenantId,
            class_id: null,
            term_id: null,
            name: slot.name,
            start_time: slot.start,
            end_time: slot.end,
            order_index: index,
            is_break: false,
          } satisfies PeriodRow;
        });

  const idMap = new Map<number, number>();
  const createdPeriods: PeriodRow[] = [];

  for (let index = 0; index < Math.max(template.length, minCount); index++) {
    const source = template[index];
    let slot: {
      name: string;
      start_time: string;
      end_time: string;
      is_break: boolean;
      order_index: number;
    };

    if (source) {
      slot = {
        name: source.name,
        start_time: source.start_time,
        end_time: source.end_time,
        is_break: Boolean(source.is_break),
        order_index: index,
      };
    } else {
      const next = nextPeriodSlot(createdPeriods);
      slot = {
        name: next.name,
        start_time: next.start,
        end_time: next.end,
        is_break: false,
        order_index: next.order_index,
      };
    }

    const created = await createPeriod(tenantId, {
      class_id: classId,
      term_id: termId,
      name: slot.name,
      start_time: slot.start_time,
      end_time: slot.end_time,
      order_index: slot.order_index,
      is_break: slot.is_break,
    });
    createdPeriods.push(created);

    if (source?.id) idMap.set(source.id, created.id);
  }

  if (idMap.size > 0) {
    for (const [oldId, newId] of idMap.entries()) {
      await query(
        `UPDATE class_timetable
            SET period_id = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND class_id = $3 AND term_id = $4 AND period_id = $5`,
        [newId, tenantId, classId, termId, oldId]
      );
    }
  }

  return listPeriodsForClassTerm(tenantId, classId, termId);
}

function parseTimeToMinutes(value: string): number {
  const parts = String(value || '').split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const capped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function defaultPeriodWindow(index: number): { start: string; end: string; name: string } {
  const startMinutes = 7 * 60 + index * 45;
  const endMinutes = startMinutes + 45;
  return {
    name: `Period ${index + 1}`,
    start: minutesToTimeString(startMinutes),
    end: minutesToTimeString(endMinutes),
  };
}

function nextPeriodSlot(existing: PeriodRow[]): {
  start: string;
  end: string;
  name: string;
  order_index: number;
} {
  const order_index =
    existing.length > 0 ? Math.max(...existing.map((p) => p.order_index)) + 1 : 0;

  if (existing.length === 0) {
    const slot = defaultPeriodWindow(0);
    return { ...slot, order_index: 0 };
  }

  const lastEndMinutes = Math.max(...existing.map((p) => parseTimeToMinutes(p.end_time)));
  const startMinutes = lastEndMinutes;
  const endMinutes = startMinutes + 45;
  if (endMinutes >= 24 * 60) {
    throw new Error(
      'Cannot add another column — the day is full. Edit an existing column time or delete a column first.'
    );
  }

  return {
    name: `Period ${existing.length + 1}`,
    start: minutesToTimeString(startMinutes),
    end: minutesToTimeString(endMinutes),
    order_index,
  };
}

/** Ensures at least `minCount` timetable columns exist for a class + term. */
export async function ensureDefaultPeriods(
  tenantId: number,
  classId: number,
  termId: number,
  minCount = 6
): Promise<PeriodRow[]> {
  await assertClassBelongsToTenant(tenantId, classId);
  await assertTermBelongsToTenant(tenantId, termId);

  let periods = await listPeriodsForClassTerm(tenantId, classId, termId);
  if (periods.length === 0) {
    periods = await bootstrapPeriodsForClassTerm(tenantId, classId, termId, minCount);
  }

  if (periods.length >= minCount) return periods;

  for (let i = periods.length; i < minCount; i++) {
    const slot = nextPeriodSlot(periods);
    const created = await createPeriod(tenantId, {
      class_id: classId,
      term_id: termId,
      name: slot.name,
      start_time: slot.start,
      end_time: slot.end,
      order_index: slot.order_index,
    });
    periods = [...periods, created];
  }

  return listPeriodsForClassTerm(tenantId, classId, termId);
}

export async function addPeriodColumn(
  tenantId: number,
  classId: number,
  termId: number
): Promise<PeriodRow> {
  await assertClassBelongsToTenant(tenantId, classId);
  await assertTermBelongsToTenant(tenantId, termId);

  const periods = await ensureDefaultPeriods(tenantId, classId, termId, 6);
  const slot = nextPeriodSlot(periods);
  return createPeriod(tenantId, {
    class_id: classId,
    term_id: termId,
    name: slot.name,
    start_time: slot.start,
    end_time: slot.end,
    order_index: slot.order_index,
  });
}

export async function createPeriod(
  tenantId: number,
  input: {
    name: string;
    start_time: string;
    end_time: string;
    order_index?: number;
    is_break?: boolean;
    class_id?: number | null;
    term_id?: number | null;
  }
): Promise<PeriodRow> {
  const start = parseTime(input.start_time);
  const end = parseTime(input.end_time);
  if (!input.name?.trim() || !start || !end) throw new Error('Name, start time, and end time are required');

  let orderIndex = input.order_index;
  if (orderIndex == null || !Number.isFinite(orderIndex)) {
    if (input.class_id != null && input.term_id != null) {
      const max = await query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 AS next
           FROM periods
          WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3`,
        [tenantId, input.class_id, input.term_id]
      );
      orderIndex = Number(max.rows[0]?.next ?? 0);
    } else {
      const max = await query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 AS next FROM periods WHERE tenant_id = $1`,
        [tenantId]
      );
      orderIndex = Number(max.rows[0]?.next ?? 0);
    }
  }

  const isBreak = Boolean(input.is_break);
  const classId = input.class_id ?? null;
  const termId = input.term_id ?? null;

  const res = await query(
    `INSERT INTO periods (tenant_id, class_id, term_id, name, start_time, end_time, order_index, is_break, updated_at)
     VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, $8, NOW())
     RETURNING id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, is_break`,
    [tenantId, classId, termId, input.name.trim(), start, end, orderIndex, isBreak]
  );
  return res.rows[0] as PeriodRow;
}

export async function updatePeriod(
  tenantId: number,
  periodId: number,
  input: { name?: string; start_time?: string; end_time?: string; order_index?: number; is_break?: boolean }
): Promise<PeriodRow> {
  const existing = await query(
    `SELECT id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, COALESCE(is_break, false) AS is_break
       FROM periods WHERE id = $1 AND tenant_id = $2`,
    [periodId, tenantId]
  );
  if (existing.rows.length === 0) throw new Error('Period not found');
  const row = existing.rows[0];
  const start = input.start_time != null ? parseTime(input.start_time) : row.start_time;
  const end = input.end_time != null ? parseTime(input.end_time) : row.end_time;
  if (!start || !end) throw new Error('Invalid time');
  const isBreak = input.is_break != null ? Boolean(input.is_break) : Boolean(row.is_break);

  const res = await query(
    `UPDATE periods
        SET name = $3,
            start_time = $4::time,
            end_time = $5::time,
            order_index = $6,
            is_break = $7,
            updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, class_id, term_id, name, start_time::text, end_time::text, order_index, is_break`,
    [
      periodId,
      tenantId,
      input.name?.trim() || row.name,
      start,
      end,
      input.order_index != null ? input.order_index : row.order_index,
      isBreak,
    ]
  );
  return res.rows[0] as PeriodRow;
}

export async function deletePeriod(tenantId: number, periodId: number): Promise<void> {
  const res = await query(`DELETE FROM periods WHERE id = $1 AND tenant_id = $2 RETURNING id`, [periodId, tenantId]);
  if (res.rows.length === 0) throw new Error('Period not found');
}

export async function findTeacherConflict(
  tenantId: number,
  input: {
    termId: number;
    dayOfWeek: TimetableDay;
    periodId: number;
    teacherId: number;
    excludeSlotId?: number;
    excludeClassId?: number;
  }
): Promise<TeacherConflict | null> {
  const params: unknown[] = [
    tenantId,
    input.termId,
    input.dayOfWeek,
    input.periodId,
    input.teacherId,
  ];
  let excludeSql = '';
  if (input.excludeSlotId) {
    params.push(input.excludeSlotId);
    excludeSql += ` AND ct.id != $${params.length}`;
  }
  if (input.excludeClassId) {
    params.push(input.excludeClassId);
    excludeSql += ` AND ct.class_id != $${params.length}`;
  }

  const res = await query(
    `SELECT ct.teacher_id, t.full_name AS teacher_name, ct.class_id, c.class_name, ct.day_of_week, ct.period_id
       FROM class_timetable ct
       JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
       JOIN classes c ON c.id = ct.class_id AND c.tenant_id = ct.tenant_id
       JOIN periods target_p ON target_p.id = $4 AND target_p.tenant_id = ct.tenant_id
       JOIN periods existing_p ON existing_p.id = ct.period_id AND existing_p.tenant_id = ct.tenant_id
      WHERE ct.tenant_id = $1
        AND ct.term_id = $2
        AND ct.day_of_week = $3
        AND ct.teacher_id = $5
        AND existing_p.start_time < target_p.end_time
        AND existing_p.end_time > target_p.start_time
        ${excludeSql}
      LIMIT 1`,
    params
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    teacher_id: Number(row.teacher_id),
    teacher_name: String(row.teacher_name),
    class_id: Number(row.class_id),
    class_name: String(row.class_name),
    day_of_week: row.day_of_week as TimetableDay,
    period_id: Number(row.period_id),
  };
}

export async function getClassTimetableGrid(tenantId: number, classId: number, termId: number) {
  await assertClassBelongsToTenant(tenantId, classId);
  await assertTermBelongsToTenant(tenantId, termId);

  const [periods, slotsRes] = await Promise.all([
    ensureDefaultPeriods(tenantId, classId, termId, 6),
    query(
      `SELECT ct.id, ct.tenant_id, ct.class_id, ct.term_id, ct.day_of_week, ct.period_id,
              ct.subject_id, ct.teacher_id,
              s.name AS subject_name,
              t.full_name AS teacher_name,
              p.name AS period_name, p.start_time::text, p.end_time::text
         FROM class_timetable ct
         JOIN subjects s ON s.id = ct.subject_id AND s.tenant_id = ct.tenant_id
         LEFT JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
         JOIN periods p ON p.id = ct.period_id AND p.tenant_id = ct.tenant_id
        WHERE ct.tenant_id = $1 AND ct.class_id = $2 AND ct.term_id = $3
        ORDER BY p.order_index, ct.day_of_week`,
      [tenantId, classId, termId]
    ),
  ]);

  return {
    days: TIMETABLE_DAYS,
    periods,
    slots: slotsRes.rows as ClassSlotRow[],
  };
}

export async function createClassTimetableSlot(
  tenantId: number,
  input: {
    class_id: number;
    term_id: number;
    day_of_week: TimetableDay;
    period_id: number;
    subject_id: number;
    teacher_id?: number | null;
    force?: boolean;
  }
) {
  const day = parseDay(input.day_of_week);
  if (!day) throw new Error('Invalid day of week');

  await assertClassBelongsToTenant(tenantId, input.class_id);
  await assertTermBelongsToTenant(tenantId, input.term_id);
  await assertPeriodBelongsToTenant(tenantId, input.period_id);
  await assertPeriodAllowsSlots(tenantId, input.period_id);
  await assertSubjectBelongsToTenant(tenantId, input.subject_id);

  const teacherId = input.teacher_id ? Number(input.teacher_id) : null;
  if (teacherId) {
    const teacherRes = await query(`SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2`, [teacherId, tenantId]);
    if (teacherRes.rows.length === 0) throw new Error('Teacher not found');

    const conflict = await findTeacherConflict(tenantId, {
      termId: input.term_id,
      dayOfWeek: day,
      periodId: input.period_id,
      teacherId,
      excludeClassId: input.class_id,
    });
    if (conflict && !input.force) {
      const err = new Error(
        `${conflict.teacher_name} is already teaching ${conflict.class_name} during this period`
      ) as Error & { code?: string; conflict?: TeacherConflict };
      err.code = 'TEACHER_CONFLICT';
      err.conflict = conflict;
      throw err;
    }
  }

  const res = await query(
    `INSERT INTO class_timetable
       (tenant_id, class_id, term_id, day_of_week, period_id, subject_id, teacher_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (tenant_id, class_id, term_id, day_of_week, period_id)
     DO UPDATE SET subject_id = EXCLUDED.subject_id,
                   teacher_id = EXCLUDED.teacher_id,
                   updated_at = NOW()
     RETURNING id`,
    [tenantId, input.class_id, input.term_id, day, input.period_id, input.subject_id, teacherId]
  );

  const slotId = Number(res.rows[0].id);
  const slotRes = await query(
    `SELECT ct.id, ct.tenant_id, ct.class_id, ct.term_id, ct.day_of_week, ct.period_id,
            ct.subject_id, ct.teacher_id, s.name AS subject_name, t.full_name AS teacher_name
       FROM class_timetable ct
       JOIN subjects s ON s.id = ct.subject_id AND s.tenant_id = ct.tenant_id
       LEFT JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
      WHERE ct.id = $1 AND ct.tenant_id = $2`,
    [slotId, tenantId]
  );
  return slotRes.rows[0] as ClassSlotRow;
}

export async function updateClassTimetableSlot(
  tenantId: number,
  slotId: number,
  input: {
    subject_id?: number;
    teacher_id?: number | null;
    force?: boolean;
  }
) {
  const existing = await query(
    `SELECT id, class_id, term_id, day_of_week, period_id, teacher_id
       FROM class_timetable WHERE id = $1 AND tenant_id = $2`,
    [slotId, tenantId]
  );
  if (existing.rows.length === 0) throw new Error('Timetable slot not found');
  const row = existing.rows[0];

  const subjectId = input.subject_id != null ? Number(input.subject_id) : null;
  if (subjectId) await assertSubjectBelongsToTenant(tenantId, subjectId);

  const teacherId =
    input.teacher_id !== undefined
      ? input.teacher_id
        ? Number(input.teacher_id)
        : null
      : row.teacher_id
        ? Number(row.teacher_id)
        : null;

  if (teacherId) {
    const teacherRes = await query(`SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2`, [teacherId, tenantId]);
    if (teacherRes.rows.length === 0) throw new Error('Teacher not found');

    const conflict = await findTeacherConflict(tenantId, {
      termId: Number(row.term_id),
      dayOfWeek: row.day_of_week as TimetableDay,
      periodId: Number(row.period_id),
      teacherId,
      excludeSlotId: slotId,
    });
    if (conflict && !input.force) {
      const err = new Error(
        `${conflict.teacher_name} is already teaching ${conflict.class_name} during this period`
      ) as Error & { code?: string; conflict?: TeacherConflict };
      err.code = 'TEACHER_CONFLICT';
      err.conflict = conflict;
      throw err;
    }
  }

  const res = await query(
    `UPDATE class_timetable
        SET subject_id = COALESCE($3, subject_id),
            teacher_id = $4,
            updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`,
    [slotId, tenantId, subjectId, teacherId]
  );

  const updated = await query(
    `SELECT ct.id, ct.tenant_id, ct.class_id, ct.term_id, ct.day_of_week, ct.period_id,
            ct.subject_id, ct.teacher_id, s.name AS subject_name, t.full_name AS teacher_name
       FROM class_timetable ct
       JOIN subjects s ON s.id = ct.subject_id AND s.tenant_id = ct.tenant_id
       LEFT JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
      WHERE ct.id = $1 AND ct.tenant_id = $2`,
    [Number(res.rows[0].id), tenantId]
  );
  return updated.rows[0] as ClassSlotRow;
}

export async function deleteClassTimetableSlot(tenantId: number, slotId: number): Promise<void> {
  const res = await query(`DELETE FROM class_timetable WHERE id = $1 AND tenant_id = $2 RETURNING id`, [
    slotId,
    tenantId,
  ]);
  if (res.rows.length === 0) throw new Error('Timetable slot not found');
}

export async function copyClassTimetable(
  tenantId: number,
  input: { class_id: number; from_term_id: number; to_term_id: number }
) {
  await assertClassBelongsToTenant(tenantId, input.class_id);
  await assertTermBelongsToTenant(tenantId, input.from_term_id);
  await assertTermBelongsToTenant(tenantId, input.to_term_id);
  if (input.from_term_id === input.to_term_id) throw new Error('Source and destination terms must differ');

  await query(
    `DELETE FROM class_timetable
      WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3`,
    [tenantId, input.class_id, input.to_term_id]
  );

  const res = await query(
    `INSERT INTO class_timetable
       (tenant_id, class_id, term_id, day_of_week, period_id, subject_id, teacher_id, updated_at)
     SELECT tenant_id, class_id, $4, day_of_week, period_id, subject_id, teacher_id, NOW()
       FROM class_timetable
      WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3`,
    [tenantId, input.class_id, input.from_term_id, input.to_term_id]
  );

  return { copied: res.rowCount ?? 0 };
}

export async function getTeacherClassTimetable(tenantId: number, teacherId: number, termId: number) {
  await assertTermBelongsToTenant(tenantId, termId);
  const teacherRes = await query(`SELECT id, full_name FROM teachers WHERE id = $1 AND tenant_id = $2`, [
    teacherId,
    tenantId,
  ]);
  if (teacherRes.rows.length === 0) throw new Error('Teacher not found');

  const [periodsRes, slotsRes] = await Promise.all([
    query(
      `SELECT p.id, p.tenant_id, p.class_id, p.term_id, p.name, p.start_time::text, p.end_time::text,
              p.order_index, COALESCE(p.is_break, false) AS is_break
         FROM periods p
        WHERE p.tenant_id = $1
          AND p.id IN (
            SELECT DISTINCT ct.period_id
              FROM class_timetable ct
             WHERE ct.tenant_id = $1 AND ct.term_id = $2 AND ct.teacher_id = $3
          )
        ORDER BY p.start_time ASC, p.order_index ASC, p.id ASC`,
      [tenantId, termId, teacherId]
    ),
    query(
      `SELECT ct.id, ct.tenant_id, ct.class_id, ct.term_id, ct.day_of_week, ct.period_id,
              ct.subject_id, ct.teacher_id,
              s.name AS subject_name,
              c.class_name,
              p.name AS period_name, p.start_time::text, p.end_time::text
         FROM class_timetable ct
         JOIN subjects s ON s.id = ct.subject_id AND s.tenant_id = ct.tenant_id
         JOIN classes c ON c.id = ct.class_id AND c.tenant_id = ct.tenant_id
         JOIN periods p ON p.id = ct.period_id AND p.tenant_id = ct.tenant_id
        WHERE ct.tenant_id = $1 AND ct.term_id = $2 AND ct.teacher_id = $3
        ORDER BY p.order_index, ct.day_of_week`,
      [tenantId, termId, teacherId]
    ),
  ]);

  return {
    teacher: { id: teacherId, full_name: teacherRes.rows[0].full_name },
    days: TIMETABLE_DAYS,
    periods: periodsRes.rows as PeriodRow[],
    slots: slotsRes.rows as ClassSlotRow[],
  };
}

export async function listTeachersForSubjectClass(
  tenantId: number,
  subjectId: number,
  classId: number
): Promise<Array<{ id: number; full_name: string }>> {
  const res = await query(
    `SELECT DISTINCT t.id, t.full_name
       FROM teacher_subject_classes tsc
       JOIN teachers t ON t.id = tsc.teacher_id AND t.tenant_id = tsc.tenant_id
      WHERE tsc.tenant_id = $1 AND tsc.subject_id = $2 AND tsc.class_id = $3
      ORDER BY t.full_name ASC`,
    [tenantId, subjectId, classId]
  );
  return res.rows.map((r) => ({ id: Number(r.id), full_name: String(r.full_name) }));
}

export type ClassTeachingAssignment = {
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
};

/** Teachers and subjects assigned to a class via teacher_subject_classes. */
export async function listClassTeachingAssignments(
  tenantId: number,
  classId: number
): Promise<ClassTeachingAssignment[]> {
  await assertClassBelongsToTenant(tenantId, classId);
  const res = await query(
    `SELECT t.id AS teacher_id,
            t.full_name AS teacher_name,
            s.id AS subject_id,
            s.name AS subject_name
       FROM teacher_subject_classes tsc
       JOIN teachers t ON t.id = tsc.teacher_id AND t.tenant_id = tsc.tenant_id
       JOIN subjects s ON s.id = tsc.subject_id AND s.tenant_id = tsc.tenant_id
      WHERE tsc.tenant_id = $1 AND tsc.class_id = $2
      ORDER BY t.full_name ASC, s.name ASC`,
    [tenantId, classId]
  );
  return res.rows.map((r) => ({
    teacher_id: Number(r.teacher_id),
    teacher_name: String(r.teacher_name),
    subject_id: Number(r.subject_id),
    subject_name: String(r.subject_name),
  }));
}

export async function listExamTimetable(
  tenantId: number,
  filters: { class_id?: number; term_id: number }
) {
  await assertTermBelongsToTenant(tenantId, filters.term_id);
  const params: unknown[] = [tenantId, filters.term_id];
  let classSql = '';
  if (filters.class_id) {
    await assertClassBelongsToTenant(tenantId, filters.class_id);
    params.push(filters.class_id);
    classSql = ` AND et.class_id = $${params.length}`;
  }

  const res = await query(
    `SELECT et.id, et.tenant_id, et.class_id, et.term_id, et.subject_id,
            et.exam_date::text, et.start_time::text, et.end_time::text, et.venue, et.notes,
            s.name AS subject_name, c.class_name
       FROM exam_timetable et
       JOIN subjects s ON s.id = et.subject_id AND s.tenant_id = et.tenant_id
       JOIN classes c ON c.id = et.class_id AND c.tenant_id = et.tenant_id
      WHERE et.tenant_id = $1 AND et.term_id = $2
      ${classSql}
      ORDER BY et.exam_date ASC, et.start_time ASC, c.class_name ASC`,
    params
  );
  return res.rows as ExamRow[];
}

export async function createExam(
  tenantId: number,
  input: {
    class_id: number;
    term_id: number;
    subject_id: number;
    exam_date: string;
    start_time: string;
    end_time: string;
    venue?: string | null;
    notes?: string | null;
  }
) {
  await assertClassBelongsToTenant(tenantId, input.class_id);
  await assertTermBelongsToTenant(tenantId, input.term_id);
  await assertSubjectBelongsToTenant(tenantId, input.subject_id);

  const start = parseTime(input.start_time);
  const end = parseTime(input.end_time);
  const examDate = String(input.exam_date || '').trim();
  if (!examDate || !start || !end) throw new Error('Exam date, start time, and end time are required');

  const res = await query(
    `INSERT INTO exam_timetable
       (tenant_id, class_id, term_id, subject_id, exam_date, start_time, end_time, venue, notes, updated_at)
     VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::time, $8, $9, NOW())
     RETURNING id`,
    [
      tenantId,
      input.class_id,
      input.term_id,
      input.subject_id,
      examDate,
      start,
      end,
      input.venue?.trim() || null,
      input.notes?.trim() || null,
    ]
  );

  const rows = await listExamTimetable(tenantId, { term_id: input.term_id, class_id: input.class_id });
  return rows.find((r) => Number(r.id) === Number(res.rows[0].id))!;
}

export async function updateExam(
  tenantId: number,
  examId: number,
  input: Partial<{
    class_id: number;
    term_id: number;
    subject_id: number;
    exam_date: string;
    start_time: string;
    end_time: string;
    venue: string | null;
    notes: string | null;
  }>
) {
  const existing = await query(
    `SELECT * FROM exam_timetable WHERE id = $1 AND tenant_id = $2`,
    [examId, tenantId]
  );
  if (existing.rows.length === 0) throw new Error('Exam not found');
  const row = existing.rows[0];

  const classId = input.class_id ?? Number(row.class_id);
  const termId = input.term_id ?? Number(row.term_id);
  const subjectId = input.subject_id ?? Number(row.subject_id);
  await assertClassBelongsToTenant(tenantId, classId);
  await assertTermBelongsToTenant(tenantId, termId);
  await assertSubjectBelongsToTenant(tenantId, subjectId);

  const start = input.start_time != null ? parseTime(input.start_time) : row.start_time;
  const end = input.end_time != null ? parseTime(input.end_time) : row.end_time;
  const examDate = input.exam_date != null ? String(input.exam_date).trim() : row.exam_date;
  if (!examDate || !start || !end) throw new Error('Invalid exam schedule');

  await query(
    `UPDATE exam_timetable
        SET class_id = $3, term_id = $4, subject_id = $5, exam_date = $6::date,
            start_time = $7::time, end_time = $8::time, venue = $9, notes = $10, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2`,
    [
      examId,
      tenantId,
      classId,
      termId,
      subjectId,
      examDate,
      start,
      end,
      input.venue !== undefined ? input.venue?.trim() || null : row.venue,
      input.notes !== undefined ? input.notes?.trim() || null : row.notes,
    ]
  );

  const rows = await listExamTimetable(tenantId, { term_id: termId, class_id: classId });
  return rows.find((r) => Number(r.id) === examId)!;
}

export async function deleteExam(tenantId: number, examId: number): Promise<void> {
  const res = await query(`DELETE FROM exam_timetable WHERE id = $1 AND tenant_id = $2 RETURNING id`, [
    examId,
    tenantId,
  ]);
  if (res.rows.length === 0) throw new Error('Exam not found');
}

export async function getTeacherExamTimetable(tenantId: number, teacherId: number, termId: number) {
  await assertTermBelongsToTenant(tenantId, termId);
  const teacherRes = await query(`SELECT id, full_name FROM teachers WHERE id = $1 AND tenant_id = $2`, [
    teacherId,
    tenantId,
  ]);
  if (teacherRes.rows.length === 0) throw new Error('Teacher not found');

  const res = await query(
    `SELECT et.id, et.tenant_id, et.class_id, et.term_id, et.subject_id,
            et.exam_date::text, et.start_time::text, et.end_time::text, et.venue, et.notes,
            s.name AS subject_name, c.class_name
       FROM exam_timetable et
       JOIN subjects s ON s.id = et.subject_id AND s.tenant_id = et.tenant_id
       JOIN classes c ON c.id = et.class_id AND c.tenant_id = et.tenant_id
       JOIN teacher_subject_classes tsc
         ON tsc.tenant_id = et.tenant_id
        AND tsc.subject_id = et.subject_id
        AND tsc.class_id = et.class_id
        AND tsc.teacher_id = $3
      WHERE et.tenant_id = $1 AND et.term_id = $2
      ORDER BY et.exam_date ASC, et.start_time ASC`,
    [tenantId, termId, teacherId]
  );

  return {
    teacher: { id: teacherId, full_name: teacherRes.rows[0].full_name },
    exams: res.rows as ExamRow[],
  };
}
