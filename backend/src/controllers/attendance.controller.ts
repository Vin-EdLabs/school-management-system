import type { Request, Response } from 'express';
import * as service from '../services/attendance.service.js';

export async function markAttendance(req: Request, res: Response) {
  try {
    const { class_id, student_id, attendance_date, status, notes } = req.body;
    const marked_by = (req as any).user?.id;

    if (!marked_by) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!class_id || !student_id || !attendance_date || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await service.markAttendance({
      class_id: Number(class_id),
      student_id: Number(student_id),
      attendance_date,
      status,
      marked_by,
      notes
    });

    res.json({ data: result });
  } catch (err: any) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function bulkMarkAttendance(req: Request, res: Response) {
  try {
    const { records } = req.body;
    const marked_by = (req as any).user?.id;

    if (!marked_by) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    // Add marked_by to each record and validate
    const processedRecords = records.map(record => {
      if (!record.class_id || !record.student_id || !record.attendance_date || !record.status) {
        throw new Error('Each record must have class_id, student_id, attendance_date, and status');
      }

      return {
        class_id: Number(record.class_id),
        student_id: Number(record.student_id),
        attendance_date: record.attendance_date,
        status: record.status,
        marked_by,
        notes: record.notes
      };
    });

    const results = await service.bulkMarkAttendance(processedRecords);
    res.json({ data: results });
  } catch (err: any) {
    console.error('Error bulk marking attendance:', err);
    res.status(400).json({ error: err.message });
  }
}

export async function getAttendanceByClass(req: Request, res: Response) {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date query parameter is required' });
    }

    const results = await service.getAttendanceByClass(Number(classId), date as string);
    res.json({ data: results });
  } catch (err: any) {
    console.error('Error getting attendance by class:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getAttendanceByStudent(req: Request, res: Response) {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    const results = await service.getAttendanceByStudent(
      Number(studentId),
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json({ data: results });
  } catch (err: any) {
    console.error('Error getting attendance by student:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getAttendanceByDateRange(req: Request, res: Response) {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const results = await service.getAttendanceByDateRange(
      Number(classId),
      startDate as string,
      endDate as string
    );
    res.json({ data: results });
  } catch (err: any) {
    console.error('Error getting attendance by date range:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteAttendance(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await service.deleteAttendance(Number(id));
    res.json({ data: result });
  } catch (err: any) {
    console.error('Error deleting attendance:', err);
    res.status(500).json({ error: err.message });
  }
}

export default {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceByClass,
  getAttendanceByStudent,
  getAttendanceByDateRange,
  deleteAttendance
};
