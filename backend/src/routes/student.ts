import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest, requireRole, requireTenant } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

interface ParentRequest extends express.Request {
  parent?: { accountId: number; studentId: number; tenantId: number };
}

const SUBJECT_MAP: Record<string, string> = {
  mathematics: 'maths',
  maths: 'maths',
  math: 'maths',
  english: 'english',
  'english language': 'english',
  science: 'science',
  'integrated science': 'science',
  social: 'social',
  'social studies': 'social',
  rme: 'rme',
  french: 'french',
  ict: 'ict',
};

function normalizeSubject(value: string | null | undefined): string {
  const s = String(value || '').trim().toLowerCase();
  return SUBJECT_MAP[s] || s;
}

async function getTeacherScopedClassIds(tenantId: number, userId: number, teacherId: string | null | undefined) {
  const ids = new Set<number>();
  if (!teacherId) return ids;
  const direct = await query(
    `SELECT id FROM classes WHERE tenant_id = $1 AND assigned_teacher_id = $2::int`,
    [tenantId, Number(teacherId)]
  ).catch(() => ({ rows: [] as any[] }));
  for (const r of direct.rows as { id: number }[]) ids.add(Number(r.id));
  const junction = await query(
    `SELECT class_id FROM class_teachers WHERE tenant_id = $1 AND teacher_id = $2::int`,
    [tenantId, Number(teacherId)]
  ).catch(() => ({ rows: [] as any[] }));
  for (const r of junction.rows as { class_id: number }[]) ids.add(Number(r.class_id));
  return ids;
}

function normalizeClassLevel(level?: string | null, className?: string | null): string {
  const source = `${String(level || '')} ${String(className || '')}`.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/jhs\s*1/.test(source)) return 'jhs1';
  if (/jhs\s*2/.test(source)) return 'jhs2';
  if (/jhs\s*3/.test(source)) return 'jhs3';
  if (/p\s*1|primary\s*1/.test(source)) return 'p1';
  if (/p\s*2|primary\s*2/.test(source)) return 'p2';
  if (/p\s*3|primary\s*3/.test(source)) return 'p3';
  if (/p\s*4|primary\s*4/.test(source)) return 'p4';
  if (/p\s*5|primary\s*5/.test(source)) return 'p5';
  if (/p\s*6|primary\s*6/.test(source)) return 'p6';
  if (/kg\s*1/.test(source)) return 'kg1';
  if (/kg\s*2/.test(source)) return 'kg2';
  return source.replace(/\s+/g, '') || 'jhs1';
}

function startOfWeekMonday(d = new Date()): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

const authenticateParent = async (req: ParentRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    if (decoded.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const row = await query('SELECT id, student_id, tenant_id FROM parent_portal_accounts WHERE id = $1', [decoded.parentAccountId]);
    if (row.rows.length === 0) return res.status(401).json({ error: 'Invalid token' });
    req.parent = { accountId: row.rows[0].id, studentId: row.rows[0].student_id, tenantId: row.rows[0].tenant_id };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

async function getStudentContext(studentId: number, tenantId: number) {
  const studentRes = await query(
    `SELECT s.id, s.class_assigned_id, c.class_name, c.level
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  if (!studentRes.rows[0]) return null;
  const row = studentRes.rows[0];
  return {
    classId: Number(row.class_assigned_id),
    classLevel: normalizeClassLevel(row.level, row.class_name),
    className: String(row.class_name || ''),
  };
}

router.get('/questions', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const requestedClass = String(req.query.class || '').trim().toLowerCase();
    const subject = normalizeSubject(String(req.query.subject || ''));
    const term = Number(req.query.term || 1);
    const count = Math.min(Math.max(Number(req.query.count || 5), 1), 10);
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    if (![1, 2, 3].includes(term)) return res.status(400).json({ error: 'term must be 1, 2, or 3' });

    const studentCtx = await getStudentContext(studentId, tenantId);
    if (!studentCtx) return res.status(404).json({ error: 'Student not found' });
    const classLevel = requestedClass || studentCtx.classLevel;

    const rows = await query(
      `SELECT id, subject, class_level, term, question_text, option_a, option_b, option_c, option_d, correct_option
       FROM learning_questions
       WHERE class_level = $1 AND subject = $2 AND term = $3 AND is_active = true
       ORDER BY RANDOM()
       LIMIT $4`,
      [classLevel, subject, term, count]
    );

    return res.json({
      classLevel,
      subject,
      term,
      questions: rows.rows.map((q: any) => ({
        id: q.id,
        subject: q.subject,
        classLevel: q.class_level,
        term: q.term,
        questionText: q.question_text,
        options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
        correctOption: q.correct_option,
      })),
    });
  } catch (error) {
    console.error('Get learning questions error:', error);
    return res.status(500).json({ error: 'Failed to load questions' });
  }
});

router.post('/quiz-complete', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const source = String(req.body?.source || 'daily').toLowerCase() === 'teacher' ? 'teacher' : 'daily';
    const teacherQuizId = req.body?.teacher_quiz_id ? Number(req.body.teacher_quiz_id) : null;
    const subject = normalizeSubject(String(req.body?.subject || 'general'));
    const totalQuestions = Math.max(1, Number(req.body?.total_questions || req.body?.totalQuestions || 5));
    const correctAnswers = Math.max(0, Math.min(totalQuestions, Number(req.body?.correct_answers || req.body?.correctAnswers || 0)));
    const wrongAnswers = Math.max(0, Number(req.body?.wrong_answers || req.body?.wrongAnswers || (totalQuestions - correctAnswers)));
    const totalMarks = Math.max(1, Number(req.body?.total_marks || req.body?.totalMarks || totalQuestions));
    const score = Math.max(0, Number(req.body?.score || req.body?.earned_score || req.body?.earnedScore || correctAnswers));
    const studentCtx = await getStudentContext(studentId, tenantId);
    if (!studentCtx) return res.status(404).json({ error: 'Student not found' });

    const pointsEarned = Math.max(0, Number(score || correctAnswers));
    const nowDate = new Date();
    const today = nowDate.toISOString().slice(0, 10);
    const weekStart = startOfWeekMonday(nowDate);

    await query(
      `INSERT INTO quiz_sessions
       (tenant_id, student_id, subject, class_level, source, teacher_quiz_id, total_questions, correct_answers, points_earned, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [tenantId, studentId, subject, studentCtx.classLevel, source, teacherQuizId, totalQuestions, correctAnswers, pointsEarned]
    );

    const pointsRes = await query(
      `SELECT id, total_points, weekly_points, current_streak, last_quiz_date
       FROM student_points WHERE tenant_id = $1 AND student_id = $2`,
      [tenantId, studentId]
    );

    const prev = pointsRes.rows[0];
    const prevTotal = Number(prev?.total_points || 0);
    const prevWeekly = Number(prev?.weekly_points || 0);
    const prevStreak = Number(prev?.current_streak || 0);
    const prevDate = prev?.last_quiz_date ? String(prev.last_quiz_date).slice(0, 10) : null;
    const yesterday = new Date(nowDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const ymdYesterday = yesterday.toISOString().slice(0, 10);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const isSameWeekAsLast = !!prevDate && prevDate >= weekStartIso;
    const nextWeekly = (isSameWeekAsLast ? prevWeekly : 0) + pointsEarned;
    const nextStreak = prevDate === today ? prevStreak : prevDate === ymdYesterday ? prevStreak + 1 : 1;

    if (!prev) {
      await query(
        `INSERT INTO student_points
         (tenant_id, student_id, total_points, weekly_points, current_streak, last_quiz_date, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [tenantId, studentId, pointsEarned, pointsEarned, 1, today]
      );
    } else {
      await query(
        `UPDATE student_points
         SET total_points = $1, weekly_points = $2, current_streak = $3, last_quiz_date = $4, updated_at = NOW()
         WHERE tenant_id = $5 AND student_id = $6`,
        [prevTotal + pointsEarned, nextWeekly, nextStreak, today, tenantId, studentId]
      );
    }

    if (source === 'teacher' && teacherQuizId) {
      await query(
        `INSERT INTO learning_teacher_quiz_attempts
         (tenant_id, teacher_quiz_id, student_id, score, total_questions, correct_answers, wrong_answers, total_marks, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT (teacher_quiz_id, student_id)
         DO UPDATE SET score = EXCLUDED.score, total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers, wrong_answers = EXCLUDED.wrong_answers, total_marks = EXCLUDED.total_marks, completed_at = NOW()`,
        [tenantId, teacherQuizId, studentId, score, totalQuestions, correctAnswers, wrongAnswers, totalMarks]
      );
    }

    return res.json({
      success: true,
      pointsEarned,
      correctAnswers,
      totalQuestions,
      currentStreak: !prev ? 1 : nextStreak,
      weeklyPoints: !prev ? pointsEarned : nextWeekly,
    });
  } catch (error) {
    console.error('Complete quiz error:', error);
    return res.status(500).json({ error: 'Failed to save quiz result' });
  }
});

router.get('/leaderboard', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const myStudentId = req.parent!.studentId;
    const classId = Number(req.query.class_id);
    if (!Number.isFinite(classId)) return res.status(400).json({ error: 'class_id is required' });
    const weekStart = startOfWeekMonday();
    const weekStartIso = weekStart.toISOString();

    const rows = await query(
      `SELECT s.id as student_id, s.first_name, s.last_name, COALESCE(SUM(qs.points_earned), 0)::int as weekly_points
       FROM students s
       LEFT JOIN quiz_sessions qs
         ON qs.student_id = s.id
        AND qs.tenant_id = s.tenant_id
        AND qs.completed_at >= $3::timestamp
       WHERE s.tenant_id = $1 AND s.class_assigned_id = $2
       GROUP BY s.id, s.first_name, s.last_name
       ORDER BY weekly_points DESC, s.first_name ASC`,
      [tenantId, classId, weekStartIso]
    );

    const leaderboard = rows.rows.map((r: any, idx: number) => ({
      rank: idx + 1,
      studentId: Number(r.student_id),
      name: `${r.first_name} ${r.last_name}`.trim(),
      points: Number(r.weekly_points || 0),
      isMe: Number(r.student_id) === myStudentId,
    }));
    const me = leaderboard.find((x) => x.isMe) || null;
    return res.json({ weekStart: weekStartIso, leaderboard, me });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/stats', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const weekStart = startOfWeekMonday();
    const weekStartIso = weekStart.toISOString();
    const pointsRow = await query(
      `SELECT total_points, weekly_points, current_streak, last_quiz_date
       FROM student_points
       WHERE tenant_id = $1 AND student_id = $2`,
      [tenantId, studentId]
    );
    const sessionAgg = await query(
      `SELECT
          COUNT(*)::int AS quizzes_done_week,
          COALESCE(SUM(correct_answers), 0)::int AS total_correct_week,
          COALESCE(SUM(total_questions), 0)::int AS total_questions_week
       FROM quiz_sessions
       WHERE tenant_id = $1 AND student_id = $2 AND completed_at >= $3::timestamp`,
      [tenantId, studentId, weekStartIso]
    ).catch(() => ({ rows: [{ quizzes_done_week: 0, total_correct_week: 0, total_questions_week: 0 }] as any[] }));
    const points = pointsRow.rows[0] || { total_points: 0, weekly_points: 0, current_streak: 0, last_quiz_date: null };
    const agg = sessionAgg.rows[0] || { quizzes_done_week: 0, total_correct_week: 0, total_questions_week: 0 };
    const totalCorrect = Number(agg.total_correct_week || 0);
    const totalQuestions = Number(agg.total_questions_week || 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return res.json({
      studentId,
      totalPoints: Number(points.total_points || 0),
      weeklyPoints: Number(points.weekly_points || 0),
      currentStreak: Number(points.current_streak || 0),
      lastQuizDate: points.last_quiz_date || null,
      quizzesDoneWeek: Number(agg.quizzes_done_week || 0),
      accuracyWeek: accuracy,
    });
  } catch (error) {
    console.error('Student stats error:', error);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/recent-sessions', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const rows = await query(
      `SELECT id, subject, source, teacher_quiz_id, total_questions, correct_answers, points_earned, completed_at
       FROM quiz_sessions
       WHERE tenant_id = $1 AND student_id = $2
       ORDER BY completed_at DESC
       LIMIT 20`,
      [tenantId, studentId]
    );
    return res.json({ sessions: rows.rows });
  } catch (error) {
    console.error('Recent sessions error:', error);
    return res.status(500).json({ error: 'Failed to load recent sessions' });
  }
});

router.get('/teacher-quizzes', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const studentCtx = await getStudentContext(studentId, tenantId);
    if (!studentCtx) return res.status(404).json({ error: 'Student not found' });

    const rows = await query(
      `SELECT q.id, q.title, q.subject, q.due_date, q.teacher_name, q.created_at,
              CASE WHEN a.id IS NULL THEN false ELSE true END AS completed
       FROM learning_teacher_quizzes q
       LEFT JOIN learning_teacher_quiz_attempts a
         ON a.teacher_quiz_id = q.id AND a.student_id = $3
       WHERE q.tenant_id = $1
         AND q.class_id = $2
         AND q.is_published = true
       ORDER BY q.due_date ASC NULLS LAST, q.created_at DESC`,
      [tenantId, studentCtx.classId, studentId]
    );
    return res.json({ quizzes: rows.rows });
  } catch (error) {
    console.error('Teacher quizzes error:', error);
    return res.status(500).json({ error: 'Failed to load teacher quizzes' });
  }
});

router.get('/subjects', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = req.parent!.studentId;
    const studentCtx = await getStudentContext(studentId, tenantId);
    if (!studentCtx) return res.status(404).json({ error: 'Student not found' });

    const subjectRows = await query(
      `SELECT DISTINCT LOWER(TRIM(name)) as name
       FROM subjects
       WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => ({ rows: [] as any[] }));
    if (!subjectRows.rows.length) return res.json({ subjects: [] });

    const teachersForClass = await query(
      `SELECT DISTINCT t.subjects_taught
       FROM teachers t
       LEFT JOIN class_teachers ct ON ct.teacher_id = t.id AND ct.tenant_id = t.tenant_id
       WHERE t.tenant_id = $1
         AND (t.class_assigned_id = $2 OR ct.class_id = $2)`,
      [tenantId, studentCtx.classId]
    ).catch(() => ({ rows: [] as any[] }));

    const teacherSubjects = new Set<string>();
    for (const row of teachersForClass.rows as { subjects_taught?: string[] }[]) {
      const arr = Array.isArray(row.subjects_taught) ? row.subjects_taught : [];
      for (const s of arr) teacherSubjects.add(normalizeSubject(s));
    }

    const systemSubjects = new Set<string>();
    for (const row of subjectRows.rows as { name: string }[]) {
      systemSubjects.add(normalizeSubject(row.name));
    }

    const allowed = [...systemSubjects].filter((s) => teacherSubjects.size === 0 || teacherSubjects.has(s));
    return res.json({ subjects: allowed });
  } catch (error) {
    console.error('Get learning subjects error:', error);
    return res.status(500).json({ error: 'Failed to load subjects' });
  }
});

router.get('/teacher-quiz/:id/questions', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRes = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, q.due_date
       FROM learning_teacher_quizzes q
       WHERE q.id = $1 AND q.tenant_id = $2 AND q.is_published = true`,
      [quizId, tenantId]
    );
    if (!quizRes.rows[0]) return res.status(404).json({ error: 'Quiz not found' });
    const rows = await query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option
            , marks
       FROM learning_teacher_quiz_questions
       WHERE teacher_quiz_id = $1 AND tenant_id = $2
       ORDER BY id ASC`,
      [quizId, tenantId]
    );
    return res.json({
      quiz: quizRes.rows[0],
      questions: rows.rows.map((q: any) => ({
        id: q.id,
        questionText: q.question_text,
        options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
        correctOption: q.correct_option,
        marks: Number(q.marks || 1),
      })),
    });
  } catch (error) {
    console.error('Teacher quiz questions error:', error);
    return res.status(500).json({ error: 'Failed to load teacher quiz questions' });
  }
});

router.post('/teacher-quizzes', authenticate, requireTenant, requireRole('teacher', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherName = req.user!.fullName || req.user!.username;
    const title = String(req.body?.title || '').trim();
    const classId = Number(req.body?.class_id);
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!title || !subject || !Number.isFinite(classId) || questions.length === 0) {
      return res.status(400).json({ error: 'title, class_id, subject and questions are required' });
    }
    if (req.user!.role === 'teacher') {
      const allowedClassIds = await getTeacherScopedClassIds(tenantId, req.user!.id, req.user!.teacherId);
      if (!allowedClassIds.has(classId)) {
        return res.status(403).json({ error: 'You can only publish quizzes for your assigned class(es).' });
      }
      const teacherRow = await query(
        'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
        [tenantId, Number(req.user!.teacherId)]
      ).catch(() => ({ rows: [] as any[] }));
      const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
      if (taught.length > 0 && !taught.includes(subject)) {
        return res.status(403).json({ error: 'You can only publish quizzes for your assigned subject(s).' });
      }
    }

    const quizRes = await query(
      `INSERT INTO learning_teacher_quizzes
       (tenant_id, teacher_user_id, teacher_name, title, class_id, subject, due_date, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING id`,
      [tenantId, req.user!.id, teacherName, title, classId, subject, dueDate]
    );
    const quizId = Number(quizRes.rows[0].id);
    for (const q of questions) {
      const questionText = String(q?.question_text || q?.questionText || '').trim();
      const optionA = String(q?.option_a || q?.optionA || '').trim();
      const optionB = String(q?.option_b || q?.optionB || '').trim();
      const optionC = String(q?.option_c || q?.optionC || '').trim();
      const optionD = String(q?.option_d || q?.optionD || '').trim();
      const correctOption = String(q?.correct_option || q?.correctOption || '').trim().toLowerCase();
      const marks = Math.max(1, Number(q?.marks || 1));
      if (!questionText || !optionA || !optionB || !optionC || !optionD || !['a', 'b', 'c', 'd'].includes(correctOption)) continue;
      await query(
        `INSERT INTO learning_teacher_quiz_questions
         (tenant_id, teacher_quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, quizId, questionText, optionA, optionB, optionC, optionD, correctOption, marks]
      );
    }
    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
        tenantId,
        entity: 'learning-teacher-quiz',
        action: 'created',
        classId,
        at: Date.now(),
      });
    } catch {
      /* ignore realtime failures */
    }
    return res.status(201).json({ success: true, id: quizId });
  } catch (error) {
    console.error('Create teacher quiz error:', error);
    return res.status(500).json({ error: 'Failed to create teacher quiz' });
  }
});

router.put('/teacher-quizzes/:id', authenticate, requireTenant, requireRole('teacher', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRow = await query(
      `SELECT id, teacher_user_id FROM learning_teacher_quizzes
       WHERE id = $1 AND tenant_id = $2`,
      [quizId, tenantId]
    );
    if (!quizRow.rows[0]) return res.status(404).json({ error: 'Quiz not found' });
    if (req.user!.role === 'teacher' && Number(quizRow.rows[0].teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only edit quizzes you created.' });
    }

    const title = String(req.body?.title || '').trim();
    const classId = Number(req.body?.class_id);
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!title || !subject || !Number.isFinite(classId) || questions.length === 0) {
      return res.status(400).json({ error: 'title, class_id, subject and questions are required' });
    }

    if (req.user!.role === 'teacher') {
      const allowedClassIds = await getTeacherScopedClassIds(tenantId, req.user!.id, req.user!.teacherId);
      if (!allowedClassIds.has(classId)) {
        return res.status(403).json({ error: 'You can only publish quizzes for your assigned class(es).' });
      }
      const teacherRow = await query(
        'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
        [tenantId, Number(req.user!.teacherId)]
      ).catch(() => ({ rows: [] as any[] }));
      const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
      if (taught.length > 0 && !taught.includes(subject)) {
        return res.status(403).json({ error: 'You can only publish quizzes for your assigned subject(s).' });
      }
    }

    await query(
      `UPDATE learning_teacher_quizzes
       SET title = $1, class_id = $2, subject = $3, due_date = $4, is_published = true
       WHERE id = $5 AND tenant_id = $6`,
      [title, classId, subject, dueDate, quizId, tenantId]
    );

    await query(
      `DELETE FROM learning_teacher_quiz_questions
       WHERE teacher_quiz_id = $1 AND tenant_id = $2`,
      [quizId, tenantId]
    );

    for (const q of questions) {
      const questionText = String(q?.question_text || q?.questionText || '').trim();
      const optionA = String(q?.option_a || q?.optionA || '').trim();
      const optionB = String(q?.option_b || q?.optionB || '').trim();
      const optionC = String(q?.option_c || q?.optionC || '').trim();
      const optionD = String(q?.option_d || q?.optionD || '').trim();
      const correctOption = String(q?.correct_option || q?.correctOption || '').trim().toLowerCase();
      const marks = Math.max(1, Number(q?.marks || 1));
      if (!questionText || !optionA || !optionB || !optionC || !optionD || !['a', 'b', 'c', 'd'].includes(correctOption)) continue;
      await query(
        `INSERT INTO learning_teacher_quiz_questions
         (tenant_id, teacher_quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, quizId, questionText, optionA, optionB, optionC, optionD, correctOption, marks]
      );
    }

    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
        tenantId,
        entity: 'learning-teacher-quiz',
        action: 'updated',
        classId,
        at: Date.now(),
      });
    } catch {
      /* ignore realtime failures */
    }
    return res.json({ success: true, id: quizId });
  } catch (error) {
    console.error('Update teacher quiz error:', error);
    return res.status(500).json({ error: 'Failed to update teacher quiz' });
  }
});

router.get('/teacher-quizzes/:id/results', authenticate, requireTenant, requireRole('teacher', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRes = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quizId, tenantId]
    );
    if (!quizRes.rows[0]) return res.status(404).json({ error: 'Quiz not found' });
    const rows = await query(
      `SELECT a.student_id, a.score, a.total_questions, a.correct_answers, a.wrong_answers, a.total_marks, a.completed_at,
              s.first_name, s.last_name, s.student_id as admission_number
       FROM learning_teacher_quiz_attempts a
       JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1 AND a.teacher_quiz_id = $2
       ORDER BY a.completed_at DESC`,
      [tenantId, quizId]
    );
    return res.json({ quiz: quizRes.rows[0], attempts: rows.rows });
  } catch (error) {
    console.error('Get teacher quiz results error:', error);
    return res.status(500).json({ error: 'Failed to load quiz results' });
  }
});

router.get('/teacher-quizzes/:id/questions', authenticate, requireTenant, requireRole('teacher', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRes = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date, q.teacher_user_id
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quizId, tenantId]
    );
    const quiz = quizRes.rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (req.user!.role === 'teacher' && Number(quiz.teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only view question sets you created.' });
    }
    const rows = await query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, marks
       FROM learning_teacher_quiz_questions
       WHERE teacher_quiz_id = $1 AND tenant_id = $2
       ORDER BY id ASC`,
      [quizId, tenantId]
    );
    return res.json({
      quiz: {
        id: Number(quiz.id),
        title: quiz.title,
        subject: quiz.subject,
        class_id: Number(quiz.class_id),
        class_name: quiz.class_name,
        due_date: quiz.due_date,
      },
      questions: rows.rows.map((q: any, idx: number) => ({
        id: Number(q.id),
        index: idx + 1,
        questionText: q.question_text,
        options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
        correctOption: q.correct_option,
        marks: Number(q.marks || 1),
      })),
    });
  } catch (error) {
    console.error('Get teacher quiz question set error:', error);
    return res.status(500).json({ error: 'Failed to load question set' });
  }
});

router.get('/teacher-quizzes/my', authenticate, requireTenant, requireRole('teacher', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rows = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date, q.created_at,
              COUNT(a.id)::int as submissions
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN learning_teacher_quiz_attempts a ON a.teacher_quiz_id = q.id
       WHERE q.tenant_id = $1 AND q.teacher_user_id = $2
       GROUP BY q.id, c.class_name
       ORDER BY q.created_at DESC`,
      [tenantId, req.user!.id]
    );
    return res.json({ quizzes: rows.rows });
  } catch (error) {
    console.error('Get my teacher quizzes error:', error);
    return res.status(500).json({ error: 'Failed to load teacher quizzes' });
  }
});

export default router;
