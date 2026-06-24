import express from 'express';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  listStaffFieldSuggestions,
  persistStaffFieldSuggestion,
  type StaffFieldType,
} from '../services/staffFieldSuggestionService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

function parseFieldType(raw: unknown): StaffFieldType | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'position' || v === 'department') return v;
  return null;
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const field = parseFieldType(req.query.field);
    if (!field) {
      return res.status(400).json({ error: 'field must be position or department' });
    }
    const names = await listStaffFieldSuggestions(tenantId, field);
    res.json({ field, names });
  } catch (error) {
    console.error('List staff field suggestions error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const field = parseFieldType(req.body?.field);
    const name = String(req.body?.name || '').trim();
    if (!field) {
      return res.status(400).json({ error: 'field must be position or department' });
    }
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    await persistStaffFieldSuggestion(tenantId, field, name);
    const names = await listStaffFieldSuggestions(tenantId, field);
    res.status(201).json({ field, names });
  } catch (error) {
    console.error('Save staff field suggestion error:', error);
    res.status(500).json({ error: 'Failed to save suggestion' });
  }
});

export default router;
