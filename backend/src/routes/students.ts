import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit for Base64

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

// Get all students
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    
    let queryText = `
      SELECT s.*, c.class_name, c.level, c.stream
      FROM students s
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE s.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (classId) {
      queryText += ' AND s.class_assigned_id = $2';
      params.push(classId);
    }
    
    queryText += ' ORDER BY s.created_at DESC';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get single student
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      `SELECT s.*, c.class_name, c.level, c.stream
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentData = req.body;
    
    // Generate student ID
    const year = new Date().getFullYear();
    const existingIds = await query(
      'SELECT student_id FROM students WHERE tenant_id = $1 AND student_id ~ $2',
      [tenantId, `^${year}`]
    );
    
    let studentId = `${year}0001`;
    if (existingIds.rows.length > 0) {
      const maxId = Math.max(...existingIds.rows.map(r => parseInt(r.student_id) || 0));
      studentId = (maxId + 1).toString();
    }
    
    // Generate admission number
    const yearShort = year.toString().slice(-2);
    const existingAdmissions = await query(
      'SELECT admission_number FROM students WHERE tenant_id = $1 AND admission_number LIKE $2',
      [tenantId, `ADM${yearShort}%`]
    );
    
    let admissionNumber = `ADM${yearShort}001`;
    if (existingAdmissions.rows.length > 0) {
      const maxAdm = Math.max(
        ...existingAdmissions.rows.map(r => {
          const num = parseInt(r.admission_number.slice(5)) || 0;
          return num;
        })
      );
      admissionNumber = `ADM${yearShort}${(maxAdm + 1).toString().padStart(3, '0')}`;
    }
    
    const result = await query(
      `INSERT INTO students (
        tenant_id, first_name, last_name, gender, date_of_birth, nationality,
        student_id, admission_number, class_assigned_id, guardian_name,
        guardian_contact, home_address, number_of_siblings, names_of_siblings,
        previous_school, date_of_admission, notes, passport_photo_url,
        is_beneficiary, beneficiary_type, discount_type, discount_value, beneficiary_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        tenantId,
        studentData.first_name,
        studentData.last_name,
        studentData.gender || null,
        studentData.date_of_birth || null,
        studentData.nationality || null,
        studentId,
        admissionNumber,
        studentData.class_assigned_id || null,
        studentData.guardian_name || null,
        studentData.guardian_contact || null,
        studentData.home_address || null,
        studentData.number_of_siblings || 0,
        studentData.names_of_siblings || null,
        studentData.previous_school || null,
        studentData.date_of_admission || null,
        studentData.notes || null,
        studentData.passport_photo_url || null,
        studentData.is_beneficiary || false,
        studentData.beneficiary_type || null,
        studentData.discount_type || null,
        studentData.discount_value || 0,
        studentData.beneficiary_notes || null,
      ]
    );
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'STUDENT', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'student', 'created');
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create student error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Student ID or admission number already exists' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Upload student passport photo
router.post('/:id/photo', requireRole('super-admin', 'administrator'), upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Convert to Base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const result = await query(
      'UPDATE students SET passport_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [base64Image, id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Update student
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = [
      'first_name', 'last_name', 'gender', 'date_of_birth', 'nationality',
      'class_assigned_id', 'guardian_name', 'guardian_contact', 'home_address',
      'number_of_siblings', 'names_of_siblings', 'previous_school',
      'date_of_admission', 'notes', 'passport_photo_url',
      'is_beneficiary', 'beneficiary_type', 'discount_type', 'discount_value', 'beneficiary_notes',
      'enrollment_status',
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
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
    
    const result = await query(
      `UPDATE students SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'STUDENT', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'student', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM students WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'STUDENT', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'student', 'deleted');
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Promote student
router.post('/:id/promote', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { new_class_id, current_term, academic_year } = req.body;
    
    if (!new_class_id) {
      return res.status(400).json({ error: 'New class ID is required' });
    }
    
    // Get current class
    const studentResult = await query(
      'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const oldClassId = studentResult.rows[0].class_assigned_id;
    
    const client = await (await import('../db/connection.js')).getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update student class
      const result = await client.query(
        'UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [new_class_id, id, tenantId]
      );
      
      // Fee carryover (outstanding→arrears, credit→student_credits) is handled by
      // processFeesForClassPromotion API, called by frontend BEFORE promote.
      
      await client.query('COMMIT');
      
      // Log promotion
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, req.user!.id, 'PROMOTE', 'STUDENT', parseInt(id), JSON.stringify({ new_class_id, old_class_id: oldClassId })]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Promote student error:', error);
    res.status(500).json({ error: 'Failed to promote student' });
  }
});

export default router;
