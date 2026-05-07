import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
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

// Get all classes
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    
    const result = await query(
      `SELECT c.*, 
              COALESCE(c.class_name, c.name) as class_name,
              t.full_name as teacher_name, t.staff_id as teacher_staff_id,
              COUNT(s.id) as student_count
       FROM classes c
       LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
       LEFT JOIN students s ON s.class_assigned_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id, t.full_name, t.staff_id
       ORDER BY COALESCE(c.level, ''), COALESCE(c.stream, ''), COALESCE(c.class_name, c.name, '')`,
      [tenantId]
    );
    
    res.json(result.rows);
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
      `SELECT c.*, COALESCE(c.class_name, c.name) as class_name, t.full_name as teacher_name, t.staff_id as teacher_staff_id
       FROM classes c
       LEFT JOIN teachers t ON c.assigned_teacher_id = t.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const studentsResult = await query(
      'SELECT id, first_name, last_name, student_id, admission_number FROM students WHERE class_assigned_id = $1 AND tenant_id = $2 ORDER BY first_name, last_name',
      [id, tenantId]
    );
    
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
    const { class_name, level, stream, assigned_teacher_id, max_class_size } = req.body;
    
    if (!class_name) {
      return res.status(400).json({ error: 'Class name is required' });
    }
    
    // Support both modern schema (class_name) and legacy schema (name)
    let result: any;
    try {
      result = await query(
        `INSERT INTO classes (tenant_id, class_name, name, level, stream, assigned_teacher_id, max_class_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          tenantId,
          class_name,
          class_name,
          level || null,
          stream || null,
          assigned_teacher_id || null,
          max_class_size || 30,
        ]
      );
    } catch {
      result = await query(
        `INSERT INTO classes (tenant_id, name, level, stream, assigned_teacher_id, max_class_size)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          tenantId,
          class_name,
          level || null,
          stream || null,
          assigned_teacher_id || null,
          max_class_size || 30,
        ]
      );
    }
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'CLASS', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'class', 'created');
    
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
    
    const allowedFields = ['class_name', 'level', 'stream', 'assigned_teacher_id', 'max_class_size'];
    
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
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    let result;
    try {
      result = await query(
        `UPDATE classes SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
        values
      );
    } catch {
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
          updates.class_name,
          updates.level,
          updates.stream,
          updates.assigned_teacher_id,
          updates.max_class_size,
          tenantId,
          id
        ]
      );
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
    const updated = await query(
      `SELECT ct.*, t.full_name, t.staff_id FROM class_teachers ct JOIN teachers t ON ct.teacher_id = t.id
       WHERE ct.class_id = $1 AND ct.tenant_id = $2`,
      [id, tenantId]
    );
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
    
    // Verify both classes exist
    const classesCheck = await query(
      'SELECT id FROM classes WHERE id IN ($1, $2) AND tenant_id = $3',
      [id, new_class_id, tenantId]
    );
    
    if (classesCheck.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both classes not found' });
    }
    
    // Update all students in the class
    await query(
      'UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP WHERE class_assigned_id = $2 AND tenant_id = $3',
      [new_class_id, id, tenantId]
    );
    
    // Log promotion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, 'PROMOTE_CLASS', 'CLASS', parseInt(id), JSON.stringify({ new_class_id })]
    );
    
    res.json({ message: 'Class promoted successfully' });
  } catch (error) {
    console.error('Promote class error:', error);
    res.status(500).json({ error: 'Failed to promote class' });
  }
});

export default router;
