import type { Request, Response } from 'express';
import * as subjectsRepo from '../repositories/subjects.repository.js';
import * as gradeBoundariesService from '../services/gradeBoundaries.service.js';
import * as gradesService from '../services/grades.service.js';
import { failure, success } from '../utils/response.js';

export async function listExamTypes(req: Request, res: Response) {
  try {
    const list = await gradesService.listExamTypes();
    return res.json(success(list));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function createExamType(req: Request, res: Response) {
  try {
    if (!req.body?.name) return res.status(400).json(failure('Missing name'));
    const created = await gradesService.createExamType({ name: req.body.name, weight: req.body.weight, created_by: (req as any).user?.id });
    return res.status(201).json(success(created));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function createExam(req: Request, res: Response) {
  try {
    const payload = req.body || {};
    payload.created_by = (req as any).user?.id;
    const created = await gradesService.createExam(payload);
    return res.status(201).json(success(created));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function listExams(req: Request, res: Response) {
  try {
    const filter: any = {};
    if (req.query.classId) filter.classId = Number(req.query.classId);
    if (req.query.subjectId) filter.subjectId = Number(req.query.subjectId);
    if (req.query.term) filter.term = String(req.query.term);
    const raw = await gradesService.listExams(filter);
    // Normalize to frontend-friendly shape
    const list = (raw || []).map((e: any) => ({
      id: String(e.id),
      name: e.exam_name ?? e.name ?? `${e.exam_type_name || 'Exam'} — ${e.subject_name || ''}`.trim(),
      type: e.exam_type_name ?? e.type ?? 'Exam',
      maxScore: e.max_score ?? e.maxScore ?? e.max_marks ?? 100,
      examDate: e.exam_date ?? e.examDate ?? e.created_at ?? null,
      classId: String(e.class_id ?? e.classId ?? e.classId),
      subjectId: String(e.subject_id ?? e.subjectId ?? e.subject_id),
      term: e.term ?? null,
      isLocked: !!e.is_locked,
      isPublished: !!e.is_published,
      raw: e
    }));
    return res.json(success(list));
  } catch (err: any) {
    // Log full error for diagnostics
    // eslint-disable-next-line no-console
    console.error('[grades.controller.listExams] error:', err, 'query:', req.query);
    return res.status(500).json(failure(err.message));
  }
}

export async function lockExam(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { locked } = req.body;
    // permission check: only subject teacher or admin can lock/unlock
    const exam: any = await gradesService.getExam(id);
    const subject = exam?.subject_id ? await subjectsRepo.getSubject(exam.subject_id) : null;
    const user = (req as any).user;
    const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
    const isSubjectTeacher = subject && user && subject.teacher_id && Number(subject.teacher_id) === Number(user.id);
    if (!isAdmin && !isSubjectTeacher) return res.status(403).json(failure('Forbidden: not allowed to lock/unlock this exam'));

    const updated = await gradesService.lockExam(id, !!locked);
    return res.json(success(updated));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function getGrades(req: Request, res: Response) {
  try {
    const examId = Number(req.params.id);
    const raw = await gradesService.getGrades(examId);
    // Normalize grade rows to frontend-friendly shape
    const list = (raw || []).map((g: any) => ({
      id: g.id ? String(g.id) : (g.grade_id ? String(g.grade_id) : null),
      studentId: String(g.student_id ?? g.studentId ?? g.student?.id ?? g.studentId),
      student_name: g.student_name ?? g.student?.name ?? null,
      // `assignmentId` is what the client uses for exam/assignment id
      assignmentId: String(g.exam_id ?? g.assignmentId ?? examId),
      exam_id: String(g.exam_id ?? g.assignmentId ?? examId),
      score: g.score === null || typeof g.score === 'undefined' ? null : Number(g.score),
      status: g.status ?? 'OK',
      remarks: g.remarks ?? '',
      // Normalize max score naming for client (`maxScore`) while keeping raw
      maxScore: g.max_score ?? g.maxScore ?? g.max_marks ?? null,
      max_score: g.max_score ?? g.maxScore ?? g.max_marks ?? null,
      grade: g.grade ?? null
    }));
    return res.json(success(list));
  } catch (err: any) {
    // Log full error for diagnostics
    // eslint-disable-next-line no-console
    console.error('[grades.controller.getGrades] error:', err, 'params:', req.params);
    return res.status(500).json(failure(err.message));
  }
}

export async function saveGrades(req: Request, res: Response) {
  try {
    const examId = Number(req.params.id);
    const records = req.body?.records || [];
    // permission check: only subject teacher or admin can save grades
    const exam: any = await gradesService.getExam(examId);
    const subject = exam?.subject_id ? await subjectsRepo.getSubject(exam.subject_id) : null;
    const user = (req as any).user;
    const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
    const isSubjectTeacher = subject && user && subject.teacher_id && Number(subject.teacher_id) === Number(user.id);
    // Additional tolerant check: match by teacher username when numeric ids don't match
    const isSubjectTeacherByUsername = subject && user && subject.teacher_username && user.username && String(subject.teacher_username) === String(user.username);

    if (!isAdmin && !isSubjectTeacher && !isSubjectTeacherByUsername) {
      // Log diagnostic information to help debug mismatched identities
      // eslint-disable-next-line no-console
      console.error('[grades.controller.saveGrades] Forbidden save attempt:', {
        examId,
        examSubjectId: exam?.subject_id,
        subjectTeacherId: subject?.teacher_id,
        subjectTeacherUsername: subject?.teacher_username,
        requestUser: user,
        recordsCount: Array.isArray(records) ? records.length : 0
      });
      return res.status(403).json(failure('Forbidden: not allowed to save grades for this exam'));
    }

    const result = await gradesService.saveGrades(examId, records, (req as any).user?.id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function updateGrade(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    // permission: only subject teacher or admin can update grade
    // need to fetch grade -> exam -> subject
    const gradeRows: any = await (await import('../config/db.js')).query('SELECT * FROM grades WHERE id = $1 LIMIT 1', [id]);
    const grade = gradeRows.rows[0];
    if (!grade) return res.status(404).json(failure('Grade not found'));
    const exam: any = await gradesService.getExam(grade.exam_id);
    const subject = exam?.subject_id ? await subjectsRepo.getSubject(exam.subject_id) : null;
    const user = (req as any).user;
    const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
    const isSubjectTeacher = subject && user && subject.teacher_id && Number(subject.teacher_id) === Number(user.id);
    if (!isAdmin && !isSubjectTeacher) return res.status(403).json(failure('Forbidden: not allowed to update this grade'));

    const updated = await gradesService.updateGrade(id, req.body, (req as any).user?.id);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function removeGrade(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    // permission: only subject teacher or admin can delete grade
    const gradeRows: any = await (await import('../config/db.js')).query('SELECT * FROM grades WHERE id = $1 LIMIT 1', [id]);
    const grade = gradeRows.rows[0];
    if (!grade) return res.status(404).json(failure('Grade not found'));
    const exam: any = await gradesService.getExam(grade.exam_id);
    const subject = exam?.subject_id ? await subjectsRepo.getSubject(exam.subject_id) : null;
    const user = (req as any).user;
    const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
    const isSubjectTeacher = subject && user && subject.teacher_id && Number(subject.teacher_id) === Number(user.id);
    if (!isAdmin && !isSubjectTeacher) return res.status(403).json(failure('Forbidden: not allowed to delete this grade'));

    const result = await gradesService.deleteGrade(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function analytics(req: Request, res: Response) {
  try {
    const examId = Number(req.params.id);
    const data = await gradesService.examAnalytics(examId);
    return res.json(success(data));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function listBoundaries(req: Request, res: Response) {
  try {
    const filter: any = {};
    if (req.query.schoolId) filter.schoolId = Number(req.query.schoolId);
    // boundaries are global; ignore classId if provided
    const data = await gradeBoundariesService.listGradeBoundaries(filter);
    return res.json(success(data));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function createBoundary(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'super-admin') return res.status(403).json(failure('Forbidden: only super-admin can create grade boundaries'));
    const payload = req.body || {};
    payload.created_by = (req as any).user?.id || null;
    const created = await gradeBoundariesService.createGradeBoundary(payload);
    return res.status(201).json(success(created));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function updateBoundary(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'super-admin') return res.status(403).json(failure('Forbidden: only super-admin can update grade boundaries'));
    const id = Number(req.params.id);
    const patch = req.body || {};
    const updated = await gradeBoundariesService.updateGradeBoundary(id, patch);
    return res.json(success(updated));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function deleteBoundary(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'super-admin') return res.status(403).json(failure('Forbidden: only super-admin can delete grade boundaries'));
    const id = Number(req.params.id);
    const result = await gradeBoundariesService.deleteGradeBoundary(id);
    return res.json(success(result));
  } catch (err: any) {
    if (err && err.status) return res.status(err.status).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}
