import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { levelOrderFromName, isJhs3Class, graduateClassToAlumni } from '../services/academicYearEndService.js';
import { notifySetupProgressChanged } from '../services/setupProgressService.js';

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

async function listClasses(tenantId: number, academicYearId: number | null) {
  const orderBy =
    'ORDER BY COALESCE(c.level, \'\'), COALESCE(c.stream, \'\'), COALESCE(c.class_name, \'\')';

  if (academicYearId && !Number.isNaN(academicYearId)) {
    try {
      const result = await query(
        `SELECT c.*,
                c.class_name,
                t.full_name as teacher_name, t.staff_id as teacher_staff_id,
                COUNT(e.id) FILTER (WHERE e.status IN ('active', 'repeat')) as student_count
         FROM classes c
         LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
         LEFT JOIN student_class_enrollments e
           ON e.class_id = c.id AND e.tenant_id = c.tenant_id AND e.academic_year_id = $2
         WHERE c.tenant_id = $1
         GROUP BY c.id, t.full_name, t.staff_id
         ORDER BY COALESCE(c.level_order, 999), COALESCE(c.level, ''), COALESCE(c.stream, ''), COALESCE(c.class_name, '')`,
        [tenantId, academicYearId]
      );
      return result.rows;
    } catch {
      // fall through to roster without enrollments table
    }
  }

  try {
    const result = await query(
      `SELECT c.*, 
              c.class_name,
              t.full_name as teacher_name, t.staff_id as teacher_staff_id,
              COUNT(s.id) as student_count
       FROM classes c
       LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
       LEFT JOIN students s ON s.class_assigned_id = c.id
         AND COALESCE(s.enrollment_status, 'active') = 'active'
       WHERE c.tenant_id = $1
       GROUP BY c.id, t.full_name, t.staff_id
       ORDER BY COALESCE(c.level_order, 999), COALESCE(c.level, ''), COALESCE(c.stream, ''), COALESCE(c.class_name, '')`,
      [tenantId]
    );
    return result.rows;
  } catch {
    // Legacy schema: no level_order or enrollment_status
    const result = await query(
      `SELECT c.*, 
              c.class_name,
              t.full_name as teacher_name, t.staff_id as teacher_staff_id,
              COUNT(s.id) as student_count
       FROM classes c
       LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
       LEFT JOIN students s ON s.class_assigned_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id, t.full_name, t.staff_id
       ${orderBy}`,
      [tenantId]
    );
    return result.rows;
  }
}

// Get all classes
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const academicYearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;
    const rows = await listClasses(tenantId, academicYearId);
    res.json(rows);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get teachers assigned to a class (must be before /:id)
router.get('/:id/teachers', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const result = await query(
      `SELECT ct.*, t.full_name, t.staff_id, t.subjects_taught
       FROM class_teachers ct
       JOIN teachers t ON ct.teacher_id = t.id
       WHERE ct.class_id = $1 AND ct.tenant_id = $2 ORDER BY ct.is_main DESC, t.full_name`,
      [id, tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get class teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

// Get single class
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const classResult = await query(
      `SELECT c.*, c.class_name, t.full_name as teacher_name, t.staff_id as teacher_staff_id
       FROM classes c
       LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const academicYearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;

    let studentsResult;
    if (academicYearId && !Number.isNaN(academicYearId)) {
      studentsResult = await query(
        `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number, e.status AS enrollment_status
         FROM student_class_enrollments e
         JOIN students s ON s.id = e.student_id AND s.tenant_id = e.tenant_id
         WHERE e.class_id = $1 AND e.tenant_id = $2 AND e.academic_year_id = $3
           AND e.status IN ('active', 'repeat')
         ORDER BY s.first_name, s.last_name`,
        [id, tenantId, academicYearId]
      );
    } else {
      studentsResult = await query(
        `SELECT id, first_name, last_name, student_id, admission_number FROM students
         WHERE class_assigned_id = $1 AND tenant_id = $2
           AND COALESCE(enrollment_status, 'active') = 'active'
         ORDER BY first_name, last_name`,
        [id, tenantId]
      );
    }
    
    res.json({
      ...classResult.rows[0],
      students: studentsResult.rows,
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create class
router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { class_name, level, stream, assigned_teacher_id, max_class_size, is_final_class } = req.body;
    
    if (!class_name) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    const level_order = levelOrderFromName(level);
    const isFinal = is_final_class === true || levelOrderFromName(level) === levelOrderFromName('JHS 3') || levelOrderFromName(level) === levelOrderFromName('SHS 3');
    
    // Support both modern schema (class_name) and legacy schema (name)
    let result: any;
    try {
      result = await query(
        `INSERT INTO classes (tenant_id, class_name, name, level, stream, assigned_teacher_id, max_class_size, level_order, is_final_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [tenantId, class_name, class_name, level || null, stream || null, assigned_teacher_id || null, max_class_size || 30, level_order, isFinal]
      );
    } catch (err1: any) {
      try {
        result = await query(
          `INSERT INTO classes (tenant_id, class_name, level, stream, assigned_teacher_id, max_class_size, level_order, is_final_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [tenantId, class_name, level || null, stream || null, assigned_teacher_id || null, max_class_size || 30, level_order, isFinal]
        );
      } catch (err2: any) {
        result = await query(
          `INSERT INTO classes (tenant_id, class_name, level, stream, assigned_teacher_id, max_class_size)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [tenantId, class_name, level || null, stream || null, assigned_teacher_id || null, max_class_size || 30]
        );
      }
    }
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'CLASS', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'class', 'created');
    notifySetupProgressChanged(tenantId);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['class_name', 'level', 'stream', 'assigned_teacher_id', 'max_class_size', 'is_final_class'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'class_name') {
          updateFields.push(`class_name = $${paramCount}`);
          values.push(updates[field]);
          paramCount++;
          updateFields.push(`name = $${paramCount}`);
          values.push(updates[field]);
          paramCount++;
          continue;
        }
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updates.level !== undefined) {
      updateFields.push(`level_order = $${paramCount}`);
      values.push(levelOrderFromName(updates.level));
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    let result;
    try {
      // Try updating both columns for compatibility
      result = await query(
        `UPDATE classes SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
        values
      );
    } catch (err1: any) {
      try {
        // Fallback: If 'name' column is missing, remove 'name = $x' from updateFields and try again
        const modernFields = updateFields.filter(f => !f.startsWith('name ='));
        result = await query(
          `UPDATE classes SET ${modernFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
          values
        );
      } catch (err2: any) {
        // Legacy fallback: class_name column may not exist, update using name.
        result = await query(
          `UPDATE classes
           SET name = COALESCE($1, name),
               level = COALESCE($2, level),
               stream = COALESCE($3, stream),
               assigned_teacher_id = COALESCE($4, assigned_teacher_id),
               max_class_size = COALESCE($5, max_class_size),
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = $6 AND id = $7
           RETURNING *`,
          [
            updates.class_name || updates.name,
            updates.level,
            updates.stream,
            updates.assigned_teacher_id,
            updates.max_class_size,
            tenantId,
            id
          ]
        );
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'CLASS', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'class', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete class
router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    // Check if class has students
    const studentsCheck = await query(
      'SELECT COUNT(*) as count FROM students WHERE class_assigned_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (parseInt(studentsCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete class with assigned students' });
    }
    
    const result = await query(
      'DELETE FROM classes WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'CLASS', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'class', 'deleted');
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// Add teacher to class (supports multiple teachers, is_main for primary)
router.post('/:id/teachers', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { teacher_id, is_main } = req.body;
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });
    const classCheck = await query('SELECT id FROM classes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    const teacherCheck = await query('SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2', [teacher_id, tenantId]);
    if (classCheck.rows.length === 0 || teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class or teacher not found' });
    }
    if (is_main) {
      await query('UPDATE class_teachers SET is_main = false WHERE class_id = $1 AND tenant_id = $2', [id, tenantId]);
      await query('UPDATE classes SET assigned_teacher_id = $1 WHERE id = $2 AND tenant_id = $3', [teacher_id, id, tenantId]);
    }
    await query(
      `INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_main)
       VALUES ($1, $2, $3, $4) ON CONFLICT (class_id, teacher_id) DO UPDATE SET is_main = $4`,
      [tenantId, id, teacher_id, !!is_main]
    );
    await query(
      `UPDATE teachers SET class_assigned_id = $1::int
       WHERE id = $2::int AND tenant_id = $3 AND class_assigned_id IS NULL`,
      [id, teacher_id, tenantId]
    ).catch(() => {});
    const updated = await query(
      `SELECT ct.*, t.full_name, t.staff_id FROM class_teachers ct JOIN teachers t ON ct.teacher_id = t.id
       WHERE ct.class_id = $1 AND ct.tenant_id = $2`,
      [id, tenantId]
    );
    emitTenantDataChanged(tenantId, 'class', 'updated');
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json(updated.rows);
  } catch (error: any) {
    if (error.code === '42P01') return res.status(500).json({ error: 'class_teachers table not found' });
    console.error('Add class teacher error:', error);
    res.status(500).json({ error: 'Failed to add teacher to class' });
  }
});

// Remove teacher from class
router.delete('/:id/teachers/:teacherId', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id, teacherId } = req.params;
    const ct = await query('SELECT * FROM class_teachers WHERE class_id = $1 AND teacher_id = $2 AND tenant_id = $3', [id, teacherId, tenantId]);
    if (ct.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    const wasMain = ct.rows[0].is_main;
    await query('DELETE FROM class_teachers WHERE class_id = $1 AND teacher_id = $2 AND tenant_id = $3', [id, teacherId, tenantId]);
    if (wasMain) {
      const remaining = await query('SELECT teacher_id FROM class_teachers WHERE class_id = $1 AND tenant_id = $2 ORDER BY id LIMIT 1', [id, tenantId]);
      const newMain = remaining.rows[0]?.teacher_id || null;
      await query('UPDATE classes SET assigned_teacher_id = $1 WHERE id = $2 AND tenant_id = $3', [newMain, id, tenantId]);
      if (newMain) await query('UPDATE class_teachers SET is_main = true WHERE class_id = $1 AND teacher_id = $2', [id, newMain]);
    }
    emitTenantDataChanged(tenantId, 'class', 'updated');
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json({ message: 'Teacher removed from class' });
  } catch (error) {
    console.error('Remove class teacher error:', error);
    res.status(500).json({ error: 'Failed to remove teacher' });
  }
});

// Set main teacher for class
router.patch('/:id/teachers/:teacherId/main', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id, teacherId } = req.params;
    await query('UPDATE class_teachers SET is_main = false WHERE class_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('UPDATE class_teachers SET is_main = true WHERE class_id = $1 AND teacher_id = $2 AND tenant_id = $3', [id, teacherId, tenantId]);
    await query('UPDATE classes SET assigned_teacher_id = $1 WHERE id = $2 AND tenant_id = $3', [teacherId, id, tenantId]);
    emitTenantDataChanged(tenantId, 'class', 'updated');
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json({ message: 'Main teacher updated' });
  } catch (error) {
    console.error('Set main teacher error:', error);
    res.status(500).json({ error: 'Failed to update main teacher' });
  }
});

// Assign students to class
router.post('/:id/assign-students', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { student_ids } = req.body;
    
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: 'Student IDs array is required' });
    }
    
    // Verify class exists
    const classCheck = await query(
      'SELECT id, max_class_size FROM classes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const maxSize = classCheck.rows[0].max_class_size;
    const currentCount = await query(
      'SELECT COUNT(*) as count FROM students WHERE class_assigned_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (parseInt(currentCount.rows[0].count) + student_ids.length > maxSize) {
      return res.status(400).json({ error: 'Class size limit exceeded' });
    }
    
    // Update students
    await query(
      `UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($2::int[]) AND tenant_id = $3`,
      [id, student_ids, tenantId]
    );
    
    // Log assignment
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, 'ASSIGN_STUDENTS', 'CLASS', parseInt(id), JSON.stringify({ student_ids })]
    );
    
    res.json({ message: 'Students assigned successfully' });
  } catch (error) {
    console.error('Assign students error:', error);
    res.status(500).json({ error: 'Failed to assign students' });
  }
});

// Promote class
router.post('/:id/promote', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { new_class_id } = req.body;

    if (!new_class_id) {
      return res.status(400).json({ error: 'New class ID is required' });
    }

    const classesCheck = await query(
      'SELECT id, level, class_name FROM classes WHERE id IN ($1, $2) AND tenant_id = $3',
      [id, new_class_id, tenantId]
    );

    if (classesCheck.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both classes not found' });
    }

    const sourceClass = classesCheck.rows.find((r) => String(r.id) === String(id));
    if (sourceClass && isJhs3Class(sourceClass)) {
      return res.status(400).json({
        error: 'JHS 3 cannot be promoted to another class. Use Move to Alumni instead.',
      });
    }

    await query(
      'UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP WHERE class_assigned_id = $2 AND tenant_id = $3',
      [new_class_id, id, tenantId]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, 'PROMOTE_CLASS', 'CLASS', parseInt(id), JSON.stringify({ new_class_id })]
    );

    emitTenantDataChanged(tenantId, 'class', 'updated');
    res.json({ message: 'Class promoted successfully' });
  } catch (error) {
    console.error('Promote class error:', error);
    res.status(500).json({ error: 'Failed to promote class' });
  }
});

// Graduate entire JHS 3 class to alumni
router.post('/:id/graduate-to-alumni', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(req.params.id, 10);
    if (!classId || Number.isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }

    const result = await graduateClassToAlumni(tenantId, classId);

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        tenantId,
        req.user!.id,
        'GRADUATE_CLASS',
        'CLASS',
        classId,
        JSON.stringify({ graduated: result.graduated, className: result.className }),
      ]
    );

    emitTenantDataChanged(tenantId, 'student', 'updated');
    res.json({
      message: `${result.graduated} student(s) moved to Alumni`,
      graduated: result.graduated,
      className: result.className,
    });
  } catch (error: any) {
    console.error('Graduate class error:', error);
    res.status(400).json({ error: error.message || 'Failed to graduate class' });
  }
});

export default router;
