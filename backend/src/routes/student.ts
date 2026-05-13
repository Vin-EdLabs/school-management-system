import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest, requireRole, requireTenant } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { sendPushToClassParents } from '../services/webPushService.js';

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

function actsAsInstructor(u: { role?: string; teacherId?: string | null } | undefined): boolean {
  if (!u?.role) return false;
  const r = String(u.role).toLowerCase();
  if (r === 'teacher') return true;
  if (r === 'staff' && u.teacherId) return true;
  return false;
}

function isElevatedQuizUser(u: { role?: string } | undefined): boolean {
  if (!u?.role) return false;
  const r = String(u.role).toLowerCase();
  return r === 'administrator' || r === 'finance' || r === 'super-admin' || r === 'superadmin';
}

type ParsedQuizQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: number;
  questionType: 'mcq' | 'true_false';
};

function parseQuestionType(q: { question_type?: string; questionType?: string } | null | undefined): 'mcq' | 'true_false' {
  const t = String(q?.question_type || q?.questionType || 'mcq').toLowerCase();
  return t === 'true_false' || t === 'tf' ? 'true_false' : 'mcq';
}

function normalizeTeacherQuizQuestionInput(q: any): ParsedQuizQuestion | null {
  const questionType = parseQuestionType(q);
  const questionText = String(q?.question_text || q?.questionText || '').trim();
  const marks = Math.max(1, Number(q?.marks || 1));
  let optionA = String(q?.option_a || q?.optionA || '').trim();
  let optionB = String(q?.option_b || q?.optionB || '').trim();
  let optionC = String(q?.option_c || q?.optionC || '').trim();
  let optionD = String(q?.option_d || q?.optionD || '').trim();
  const correctRaw = String(q?.correct_option || q?.correctOption || '').trim().toLowerCase();
  if (!questionText) return null;
  if (questionType === 'true_false') {
    optionA = optionA || 'True';
    optionB = optionB || 'False';
    optionC = '';
    optionD = '';
    if (!['a', 'b'].includes(correctRaw)) return null;
    return { questionText, optionA, optionB, optionC, optionD, correctOption: correctRaw, marks, questionType };
  }
  if (!optionA || !optionB || !optionC || !optionD || !['a', 'b', 'c', 'd'].includes(correctRaw)) return null;
  return { questionText, optionA, optionB, optionC, optionD, correctOption: correctRaw, marks, questionType: 'mcq' };
}

async function notifyAssessmentPublished(
  tenantId: number,
  classId: number,
  teacherName: string,
  title: string,
  subject: string,
  dueDate: string | null
) {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'learning-teacher-quiz',
      action: 'published',
      classId,
      title,
      at: Date.now(),
    });
  } catch {
    /* ignore realtime failures */
  }
  const subjectLabel = String(subject || '').toUpperCase();
  const dueLine = dueDate ? ` Due ${dueDate}.` : '';
  void sendPushToClassParents(tenantId, classId, {
    title: 'New online assessment',
    body: `${teacherName} posted “${title}” (${subjectLabel}) for your child’s class.${dueLine} Open the parent portal to complete it.`,
    url: `/portal/${tenantId}`,
  }).catch((err) => console.error('[push] notify parents new assessment:', err));
}

async function insertParsedQuestionsForQuiz(tenantId: number, quizId: number, list: ParsedQuizQuestion[]) {
  for (const p of list) {
    await query(
      `INSERT INTO learning_teacher_quiz_questions
       (tenant_id, teacher_quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, question_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tenantId,
        quizId,
        p.questionText,
        p.optionA,
        p.optionB,
        p.optionC,
        p.optionD,
        p.correctOption,
        p.marks,
        p.questionType,
      ]
    );
  }
}

async function buildQuestionListFromBody(
  tenantId: number,
  teacherUserId: number,
  questions: any[],
  bankQuestionIds: number[]
): Promise<{ list: ParsedQuizQuestion[]; error?: string }> {
  const list: ParsedQuizQuestion[] = [];
  const seenBank = new Set<number>();
  for (const bid of bankQuestionIds) {
    if (seenBank.has(bid)) continue;
    seenBank.add(bid);
    const row = await query(
      `SELECT question_text, option_a, option_b, option_c, option_d, correct_option, marks, question_type
       FROM learning_teacher_question_bank
       WHERE id = $1 AND tenant_id = $2 AND teacher_user_id = $3`,
      [bid, tenantId, teacherUserId]
    );
    const b = row.rows[0];
    if (!b) return { list: [], error: 'One or more bank questions were not found or do not belong to you.' };
    const parsed = normalizeTeacherQuizQuestionInput({
      question_text: b.question_text,
      option_a: b.option_a,
      option_b: b.option_b,
      option_c: b.option_c,
      option_d: b.option_d,
      correct_option: b.correct_option,
      marks: b.marks,
      question_type: b.question_type,
    });
    if (parsed) list.push(parsed);
  }
  for (const q of questions) {
    const parsed = normalizeTeacherQuizQuestionInput(q);
    if (parsed) list.push(parsed);
  }
  return { list };
}

async function getTeacherQuizQuestionCount(tenantId: number, quizId: number): Promise<number> {
  const c = await query(
    `SELECT COUNT(*)::int AS n FROM learning_teacher_quiz_questions WHERE tenant_id = $1 AND teacher_quiz_id = $2`,
    [tenantId, quizId]
  );
  return Number(c.rows[0]?.n || 0);
}

async function getTeacherQuizMeta(tenantId: number, quizId: number) {
  const r = await query(
    `SELECT id, title, subject, class_id, due_date, teacher_name, teacher_user_id, is_published
     FROM learning_teacher_quizzes WHERE id = $1 AND tenant_id = $2`,
    [quizId, tenantId]
  );
  return r.rows[0] as
    | {
        id: number;
        title: string;
        subject: string;
        class_id: number;
        due_date: string | null;
        teacher_name: string;
        teacher_user_id: number;
        is_published: boolean;
      }
    | undefined;
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
            , marks, COALESCE(question_type, 'mcq') AS question_type
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
        questionType: q.question_type === 'true_false' ? 'true_false' : 'mcq',
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

router.post('/teacher-quizzes', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const teacherName = req.user!.fullName || req.user!.username;
    const title = String(req.body?.title || '').trim();
    const classId = Number(req.body?.class_id);
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    const bankIds = Array.isArray(req.body?.bank_question_ids)
      ? req.body.bank_question_ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))
      : [];
    const isPublished = req.body?.is_published === true || req.body?.is_published === 'true';

    if (!title || !subject || !Number.isFinite(classId)) {
      return res.status(400).json({ error: 'title, class_id, and subject are required' });
    }

    const built = await buildQuestionListFromBody(tenantId, req.user!.id, questions, bankIds);
    if (built.error) return res.status(400).json({ error: built.error });
    if (isPublished && built.list.length === 0) {
      return res.status(400).json({
        error: 'Add at least one valid question (from your bank or custom) before publishing.',
      });
    }

    if (actsAsInstructor(req.user)) {
      const allowedClassIds = await getTeacherScopedClassIds(tenantId, req.user!.id, req.user!.teacherId);
      if (!allowedClassIds.has(classId)) {
        return res.status(403).json({ error: 'You can only publish assessments for your assigned class(es).' });
      }
      const teacherRow = await query(
        'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
        [tenantId, Number(req.user!.teacherId)]
      ).catch(() => ({ rows: [] as any[] }));
      const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
      if (taught.length > 0 && !taught.includes(subject)) {
        return res.status(403).json({ error: 'You can only publish assessments for your assigned subject(s).' });
      }
    }

    const quizRes = await query(
      `INSERT INTO learning_teacher_quizzes
       (tenant_id, teacher_user_id, teacher_name, title, class_id, subject, due_date, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [tenantId, req.user!.id, teacherName, title, classId, subject, dueDate, isPublished]
    );
    const quizId = Number(quizRes.rows[0].id);
    await insertParsedQuestionsForQuiz(tenantId, quizId, built.list);

    try {
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
        tenantId,
        entity: 'learning-teacher-quiz',
        action: isPublished ? 'created' : 'draft-saved',
        classId,
        quizId,
        title,
        at: Date.now(),
      });
    } catch {
      /* ignore realtime failures */
    }

    if (isPublished) {
      await notifyAssessmentPublished(tenantId, classId, teacherName, title, subject, dueDate);
    }

    return res.status(201).json({ success: true, id: quizId, is_published: isPublished });
  } catch (error) {
    console.error('Create teacher quiz error:', error);
    return res.status(500).json({ error: 'Failed to create assessment' });
  }
});

router.put('/teacher-quizzes/:id', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRow = await query(
      `SELECT id, teacher_user_id, is_published FROM learning_teacher_quizzes
       WHERE id = $1 AND tenant_id = $2`,
      [quizId, tenantId]
    );
    if (!quizRow.rows[0]) return res.status(404).json({ error: 'Quiz not found' });
    if (!isElevatedQuizUser(req.user) && Number(quizRow.rows[0].teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only edit assessments you created.' });
    }

    const wasPublished = Boolean(quizRow.rows[0].is_published);
    const bodyPub = req.body?.is_published;
    const nextPublished = typeof bodyPub === 'boolean' ? bodyPub : wasPublished;

    const title = String(req.body?.title || '').trim();
    const classId = Number(req.body?.class_id);
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    const bankIds = Array.isArray(req.body?.bank_question_ids)
      ? req.body.bank_question_ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))
      : [];

    if (!title || !subject || !Number.isFinite(classId)) {
      return res.status(400).json({ error: 'title, class_id, and subject are required' });
    }

    const built = await buildQuestionListFromBody(tenantId, req.user!.id, questions, bankIds);
    if (built.error) return res.status(400).json({ error: built.error });
    if (nextPublished && built.list.length === 0) {
      return res.status(400).json({
        error: 'A published assessment needs at least one valid question. Save as draft or add questions.',
      });
    }

    if (actsAsInstructor(req.user)) {
      const allowedClassIds = await getTeacherScopedClassIds(tenantId, req.user!.id, req.user!.teacherId);
      if (!allowedClassIds.has(classId)) {
        return res.status(403).json({ error: 'You can only publish assessments for your assigned class(es).' });
      }
      const teacherRow = await query(
        'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
        [tenantId, Number(req.user!.teacherId)]
      ).catch(() => ({ rows: [] as any[] }));
      const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
      if (taught.length > 0 && !taught.includes(subject)) {
        return res.status(403).json({ error: 'You can only publish assessments for your assigned subject(s).' });
      }
    }

    await query(
      `UPDATE learning_teacher_quizzes
       SET title = $1, class_id = $2, subject = $3, due_date = $4, is_published = $5
       WHERE id = $6 AND tenant_id = $7`,
      [title, classId, subject, dueDate, nextPublished, quizId, tenantId]
    );

    await query(`DELETE FROM learning_teacher_quiz_questions WHERE teacher_quiz_id = $1 AND tenant_id = $2`, [quizId, tenantId]);
    await insertParsedQuestionsForQuiz(tenantId, quizId, built.list);

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
    return res.json({ success: true, id: quizId, is_published: nextPublished });
  } catch (error) {
    console.error('Update teacher quiz error:', error);
    return res.status(500).json({ error: 'Failed to update assessment' });
  }
});

router.post(
  '/teacher-quizzes/:id/publish',
  authenticate,
  requireTenant,
  requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const role = String(req.user!.role || '').toLowerCase();
      if (role === 'staff' && !req.user!.teacherId) {
        return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
      }
      const quizId = Number(req.params.id);
      if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });

      const meta = await getTeacherQuizMeta(tenantId, quizId);
      if (!meta) return res.status(404).json({ error: 'Assessment not found' });
      if (!isElevatedQuizUser(req.user) && Number(meta.teacher_user_id) !== Number(req.user!.id)) {
        return res.status(403).json({ error: 'You can only publish your own assessments.' });
      }

      const title = (String(req.body?.title ?? '').trim() || String(meta.title || '').trim());
      const classId = Number.isFinite(Number(req.body?.class_id)) ? Number(req.body.class_id) : Number(meta.class_id);
      const subject = normalizeSubject(String(req.body?.subject ?? meta.subject ?? ''));
      const dueDate = req.body?.due_date != null ? String(req.body.due_date).slice(0, 10) : meta.due_date ? String(meta.due_date).slice(0, 10) : null;

      if (!title || !subject || !Number.isFinite(classId)) {
        return res.status(400).json({ error: 'title, class_id, and subject are required' });
      }

      if (actsAsInstructor(req.user)) {
        const allowedClassIds = await getTeacherScopedClassIds(tenantId, req.user!.id, req.user!.teacherId);
        if (!allowedClassIds.has(classId)) {
          return res.status(403).json({ error: 'You can only publish for your assigned class(es).' });
        }
        const teacherRow = await query(
          'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
          [tenantId, Number(req.user!.teacherId)]
        ).catch(() => ({ rows: [] as any[] }));
        const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
        if (taught.length > 0 && !taught.includes(subject)) {
          return res.status(403).json({ error: 'You can only publish for your assigned subject(s).' });
        }
      }

      const n = await getTeacherQuizQuestionCount(tenantId, quizId);
      if (n < 1) {
        return res.status(400).json({ error: 'Add at least one question before publishing.' });
      }

      const wasPublished = Boolean(meta.is_published);
      await query(
        `UPDATE learning_teacher_quizzes
         SET title = $1, class_id = $2, subject = $3, due_date = $4, is_published = true
         WHERE id = $5 AND tenant_id = $6`,
        [title, classId, subject, dueDate, quizId, tenantId]
      );

      try {
        const io = getIO();
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'learning-teacher-quiz',
          action: 'published',
          classId,
          quizId,
          title,
          at: Date.now(),
        });
      } catch {
        /* ignore */
      }

      if (!wasPublished) {
        await notifyAssessmentPublished(tenantId, classId, meta.teacher_name, title, subject, dueDate);
      }

      return res.json({ success: true, id: quizId, is_published: true });
    } catch (error) {
      console.error('Publish assessment error:', error);
      return res.status(500).json({ error: 'Failed to publish assessment' });
    }
  }
);

router.get('/question-bank', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const subjectFilter = req.query.subject ? normalizeSubject(String(req.query.subject)) : null;
    const rows = await query(
      `SELECT id, subject, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, marks, created_at,
              item_title
       FROM learning_teacher_question_bank
       WHERE tenant_id = $1 AND teacher_user_id = $2
         AND ($3::text IS NULL OR subject = $3)
       ORDER BY created_at DESC`,
      [tenantId, req.user!.id, subjectFilter]
    );
    return res.json({
      questions: rows.rows.map((r: any) => ({
        id: Number(r.id),
        subject: r.subject,
        itemTitle: r.item_title || null,
        questionType: r.question_type === 'true_false' ? 'true_false' : 'mcq',
        questionText: r.question_text,
        options: { a: r.option_a, b: r.option_b, c: r.option_c, d: r.option_d },
        correctOption: r.correct_option,
        marks: Number(r.marks || 1),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Question bank list error:', error);
    return res.status(500).json({ error: 'Failed to load question bank' });
  }
});

router.post('/question-bank', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const parsed = normalizeTeacherQuizQuestionInput(req.body);
    if (!subject || !parsed) {
      return res.status(400).json({ error: 'subject and a valid question (MCQ or True/False) are required' });
    }
    if (actsAsInstructor(req.user)) {
      const teacherRow = await query(
        'SELECT subjects_taught FROM teachers WHERE tenant_id = $1 AND id = $2::int',
        [tenantId, Number(req.user!.teacherId)]
      ).catch(() => ({ rows: [] as any[] }));
      const taught = Array.isArray(teacherRow.rows[0]?.subjects_taught) ? teacherRow.rows[0].subjects_taught.map((s: string) => normalizeSubject(s)) : [];
      if (taught.length > 0 && !taught.includes(subject)) {
        return res.status(403).json({ error: 'You can only save bank questions for subjects you teach.' });
      }
    }
    const itemTitle = String(req.body?.item_title || req.body?.itemTitle || '').trim() || null;
    const ins = await query(
      `INSERT INTO learning_teacher_question_bank
       (tenant_id, teacher_user_id, subject, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, marks, item_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        tenantId,
        req.user!.id,
        subject,
        parsed.questionType,
        parsed.questionText,
        parsed.optionA,
        parsed.optionB,
        parsed.optionC,
        parsed.optionD,
        parsed.correctOption,
        parsed.marks,
        itemTitle,
      ]
    );
    return res.status(201).json({ success: true, id: Number(ins.rows[0].id) });
  } catch (error) {
    console.error('Question bank create error:', error);
    return res.status(500).json({ error: 'Failed to save question' });
  }
});

router.put('/question-bank/:id', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await query(
      `SELECT id, teacher_user_id FROM learning_teacher_question_bank WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!isElevatedQuizUser(req.user) && Number(row.rows[0].teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only edit your own bank questions.' });
    }
    const subject = normalizeSubject(String(req.body?.subject || ''));
    const parsed = normalizeTeacherQuizQuestionInput(req.body);
    if (!subject || !parsed) {
      return res.status(400).json({ error: 'subject and a valid question are required' });
    }
    const itemTitle = String(req.body?.item_title || req.body?.itemTitle || '').trim() || null;
    await query(
      `UPDATE learning_teacher_question_bank
       SET subject = $1, question_type = $2, question_text = $3, option_a = $4, option_b = $5, option_c = $6, option_d = $7, correct_option = $8, marks = $9, item_title = $10
       WHERE id = $11 AND tenant_id = $12`,
      [
        subject,
        parsed.questionType,
        parsed.questionText,
        parsed.optionA,
        parsed.optionB,
        parsed.optionC,
        parsed.optionD,
        parsed.correctOption,
        parsed.marks,
        itemTitle,
        id,
        tenantId,
      ]
    );
    return res.json({ success: true, id });
  } catch (error) {
    console.error('Question bank update error:', error);
    return res.status(500).json({ error: 'Failed to update question' });
  }
});

router.delete('/question-bank/:id', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await query(
      `SELECT id, teacher_user_id FROM learning_teacher_question_bank WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!isElevatedQuizUser(req.user) && Number(row.rows[0].teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only delete your own bank questions.' });
    }
    await query(`DELETE FROM learning_teacher_question_bank WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Question bank delete error:', error);
    return res.status(500).json({ error: 'Failed to delete question' });
  }
});

router.get('/teacher-quizzes/:id/results', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const tenantId = req.user!.tenantId!;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRes = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date, q.teacher_user_id, q.is_published
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quizId, tenantId]
    );
    const quizRow = quizRes.rows[0];
    if (!quizRow) return res.status(404).json({ error: 'Quiz not found' });
    if (!isElevatedQuizUser(req.user) && Number(quizRow.teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only view results for quizzes you created.' });
    }
    const rows = await query(
      `SELECT a.student_id, a.score, a.total_questions, a.correct_answers, a.wrong_answers, a.total_marks, a.completed_at,
              s.first_name, s.last_name, s.student_id as admission_number
       FROM learning_teacher_quiz_attempts a
       JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1 AND a.teacher_quiz_id = $2
       ORDER BY a.completed_at DESC`,
      [tenantId, quizId]
    );
    const { teacher_user_id: _tw, ...quizOut } = quizRow as any;
    return res.json({ quiz: quizOut, attempts: rows.rows });
  } catch (error) {
    console.error('Get teacher quiz results error:', error);
    return res.status(500).json({ error: 'Failed to load quiz results' });
  }
});

router.get('/teacher-quizzes/:id/questions', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const tenantId = req.user!.tenantId!;
    const quizId = Number(req.params.id);
    if (!Number.isFinite(quizId)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quizRes = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date, q.teacher_user_id, q.is_published
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quizId, tenantId]
    );
    const quiz = quizRes.rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (!isElevatedQuizUser(req.user) && Number(quiz.teacher_user_id) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'You can only view question sets you created.' });
    }
    const rows = await query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, marks,
              COALESCE(question_type, 'mcq') AS question_type
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
        is_published: Boolean(quiz.is_published),
      },
      questions: rows.rows.map((q: any, idx: number) => ({
        id: Number(q.id),
        index: idx + 1,
        questionText: q.question_text,
        questionType: q.question_type === 'true_false' ? 'true_false' : 'mcq',
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

router.get('/teacher-quizzes/my', authenticate, requireTenant, requireRole('teacher', 'staff', 'administrator', 'finance', 'super-admin'), async (req: AuthRequest, res) => {
  try {
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'staff' && !req.user!.teacherId) {
      return res.status(403).json({ error: 'Teaching profile not linked to this staff account.' });
    }
    const tenantId = req.user!.tenantId!;
    const rows = await query(
      `SELECT q.id, q.title, q.subject, q.class_id, c.class_name, q.due_date, q.created_at, q.is_published,
              (SELECT COUNT(*)::int FROM learning_teacher_quiz_attempts a WHERE a.teacher_quiz_id = q.id) AS submissions
       FROM learning_teacher_quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       WHERE q.tenant_id = $1 AND q.teacher_user_id = $2
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
