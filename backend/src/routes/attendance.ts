import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Track all attendance records for a specific student (across all dates)
router.get('/student', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId, classId } = req.query;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }
    const conditions = ['a.tenant_id = $1', 'a.student_id = $2'];
    const params: any[] = [tenantId, studentId];
    if (classId) {
      conditions.push(`a.class_id = $${params.length + 1}`);
      params.push(classId);
    }
    const result = await query(
      `SELECT
         a.attendance_date::text AS date,
         a.present,
         c.class_name,
         a.class_id
       FROM attendance a
       JOIN classes c ON a.class_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.attendance_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch student attendance' });
  }
});

// Get all dates attendance was taken for a class (history)
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    if (!classId) {
      return res.status(400).json({ error: 'classId required' });
    }
    const result = await query(
      `SELECT
         a.attendance_date::text AS date,
         COUNT(a.id) AS total,
         SUM(CASE WHEN a.present THEN 1 ELSE 0 END) AS present_count,
         SUM(CASE WHEN NOT a.present THEN 1 ELSE 0 END) AS absent_count
       FROM attendance a
       WHERE a.tenant_id = $1 AND a.class_id = $2
       GROUP BY a.attendance_date
       ORDER BY a.attendance_date DESC
       LIMIT 60`,
      [tenantId, classId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// Get attendance for a class on a date
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, date } = req.query;
    if (!classId || !date) {
      return res.status(400).json({ error: 'classId and date required' });
    }
    // NOTE: alias a.student_id as student_db_id to avoid collision with s.student_id (admission number)
    const result = await query(
      `SELECT
         a.id AS attendance_id,
         a.student_id AS student_db_id,
         a.present,
         a.attendance_date,
         s.first_name,
         s.last_name,
         s.student_id AS admission_number,
         s.admission_number AS student_admission
       FROM attendance a
       JOIN students s ON a.student_id = s.id AND s.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1 AND a.class_id = $2 AND a.attendance_date = $3
       ORDER BY s.first_name, s.last_name`,
      [tenantId, classId, date]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Save attendance (upsert) — only records explicitly marked are saved
router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const { classId, date, records } = req.body;
    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'classId, date, and records array required' });
    }
    // Only save records that were explicitly marked (present = true or false)
    const markedRecords = records.filter(r => typeof r.present === 'boolean');
    for (const r of markedRecords) {
      await query(
        `INSERT INTO attendance (tenant_id, class_id, student_id, attendance_date, present, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, class_id, student_id, attendance_date)
         DO UPDATE SET present = EXCLUDED.present, recorded_by = EXCLUDED.recorded_by`,
        [tenantId, classId, r.studentId, date, r.present, userId]
      );
    }
    emitTenantDataChanged(tenantId, 'attendance', 'updated');
    res.json({ message: 'Attendance saved', count: markedRecords.length });
  } catch (error) {
    console.error('Save attendance error:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

export default router;
