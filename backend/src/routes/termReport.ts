import express from 'express';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachGradeAccessContext, isAdminGradeRole } from '../middleware/requireGradeAccess.js';
import { buildConfigurableTermReport } from '../services/termReportCalculatorService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to term reports' });
    }

    const classId = parseInt(String(req.query.classId || ''), 10);
    const termId = req.query.termId ? parseInt(String(req.query.termId), 10) : undefined;
    if (Number.isNaN(classId)) {
      return res.status(400).json({ error: 'classId required' });
    }

    let termOverride: string | undefined;
    let yearOverride: string | undefined;
    if (termId != null && !Number.isNaN(termId)) {
      const { query } = await import('../db/connection.js');
      const t = await query(
        `SELECT term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2`,
        [termId, tenantId]
      );
      if (t.rows.length === 0) {
        return res.status(404).json({ error: 'Term not found' });
      }
      termOverride = String(t.rows[0].term_name);
      yearOverride = String(t.rows[0].year);
    }

    let subjectIdFilter: Set<number> | undefined;
    if (req.gradeAccessRole === 'teacher') {
      const pairs = req.allowedSubjectClassPairs || [];
      const allowed = pairs.filter((p) => p.classId === classId).map((p) => p.subjectId);
      if (allowed.length === 0) {
        return res.json({
          classScoreWeight: 50,
          examWeight: 50,
          subjects: [],
          students: [],
        });
      }
      subjectIdFilter = new Set(allowed);
    }

    const report = await buildConfigurableTermReport(
      tenantId,
      classId,
      termOverride,
      yearOverride,
      { subjectIdFilter }
    );

    if (!report) {
      return res.status(404).json({ error: 'No assessments found for this class and term' });
    }

    res.json({
      classScoreWeight: report.classScoreWeight,
      examWeight: report.examWeight,
      subjects: report.subjects,
      students: report.students.map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        subjectResults: s.subjectResults.map((sr) => ({
          subjectId: sr.subjectId,
          subjectName: sr.subjectName,
          classScorePercent: sr.classScorePercent,
          examPercent: sr.examPercent,
          totalPercent: sr.totalPercent,
          gradeLabel: sr.gradeLabel,
          remark: sr.remark,
          subjectPosition: sr.subjectPosition,
        })),
        totalMarksAcrossSubjects: s.totalMarksAcrossSubjects,
        overallPosition: s.overallPosition,
      })),
      className: report.className,
      classId: report.classId,
      currentTerm: report.currentTerm,
      currentYear: report.currentYear,
      isAdminView: isAdminGradeRole(req),
    });
  } catch (error: any) {
    console.error('GET term-report error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to build term report' });
  }
});

export default router;
