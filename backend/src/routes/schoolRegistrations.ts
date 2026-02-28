import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Public: Submit registration request (no auth)
router.post('/', async (req, res) => {
  try {
    const { schoolName, adminName, email, phone, message } = req.body;

    if (!schoolName || !adminName || !email) {
      return res.status(400).json({ error: 'School name, admin name, and email are required' });
    }

    const result = await query(
      `INSERT INTO school_registrations (school_name, admin_name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, school_name, admin_name, email, phone, message, status, created_at`,
      [schoolName, adminName, email, phone || null, message || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Submit registration error:', error);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
});

// Super-admin: List all registration requests
router.get('/', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, school_name, admin_name, email, phone, message, status, internal_note, created_at
       FROM school_registrations ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Super-admin: Update registration status
router.patch('/:id/status', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE school_registrations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update registration status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Super-admin: Update internal note
router.patch('/:id/note', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { internalNote } = req.body;

    const result = await query(
      `UPDATE school_registrations SET internal_note = $1 WHERE id = $2 RETURNING id, internal_note`,
      [internalNote || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update registration note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

export default router;
