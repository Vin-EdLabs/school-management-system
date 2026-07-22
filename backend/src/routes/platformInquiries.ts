import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

const emitInquiryChanged = () => {
  try {
    getIO().to('global:general').emit('tenant-data-changed', {
      tenantId: null,
      entity: 'platform-inquiry',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    /* non-fatal */
  }
};

/** Public: submit contact / demo inquiry */
router.post('/', async (req, res) => {
  try {
    const { name, schoolName, email, phone, inquiryType, message } = req.body || {};
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const type = String(inquiryType || 'contact').trim().slice(0, 40) || 'contact';

    const result = await query(
      `INSERT INTO platform_inquiries (name, school_name, email, phone, inquiry_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, school_name, email, phone, inquiry_type, message, status, created_at`,
      [
        String(name).trim().slice(0, 200),
        schoolName ? String(schoolName).trim().slice(0, 200) : null,
        String(email).trim().slice(0, 255),
        phone ? String(phone).trim().slice(0, 50) : null,
        type,
        message ? String(message).trim().slice(0, 4000) : null,
      ]
    );

    emitInquiryChanged();
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Platform inquiry submit error:', error);
    return res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

router.get('/', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, school_name, email, phone, inquiry_type, message, status, internal_note, created_at, updated_at
         FROM platform_inquiries
        ORDER BY created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('List platform inquiries error:', error);
    return res.status(500).json({ error: 'Failed to load inquiries' });
  }
});

router.patch('/:id/status', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const status = String(req.body?.status || '').trim();
    if (!Number.isInteger(id) || !status) {
      return res.status(400).json({ error: 'Valid id and status are required' });
    }
    const result = await query(
      `UPDATE platform_inquiries SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status.slice(0, 30)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
    emitInquiryChanged();
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inquiry status error:', error);
    return res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

router.patch('/:id/note', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Valid id is required' });
    const internalNote = req.body?.internalNote != null ? String(req.body.internalNote).trim().slice(0, 4000) : null;
    const result = await query(
      `UPDATE platform_inquiries SET internal_note = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, internalNote || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
    emitInquiryChanged();
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inquiry note error:', error);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Valid id is required' });
    const result = await query(`DELETE FROM platform_inquiries WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
    emitInquiryChanged();
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    return res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

export default router;
