/**
 * Public Tenant API - No auth required
 * Resolves tenant for branding, login page, etc.
 */
import express from 'express';
import { resolveTenantById, resolveTenantBySlug } from '../services/tenantResolver.js';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { query } from '../db/connection.js';

const router = express.Router();

router.use(resolveTenant);

// Public aggregate stats for the marketing site. Keep this to non-sensitive counts only.
router.get('/public-stats', async (_req, res) => {
  try {
    const [
      schools,
      students,
      teachers,
      staff,
      payments,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM tenants WHERE is_active = true`).catch(() => ({ rows: [{ count: 0 }] })),
      query(`SELECT COUNT(*)::int AS count FROM students`).catch(() => ({ rows: [{ count: 0 }] })),
      query(`SELECT COUNT(*)::int AS count FROM teachers`).catch(() => ({ rows: [{ count: 0 }] })),
      query(`SELECT COUNT(*)::int AS count FROM other_staff`).catch(() => ({ rows: [{ count: 0 }] })),
      query(`SELECT COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0)::numeric AS total FROM payments WHERE COALESCE(is_voided, false) = false`).catch(() => ({ rows: [{ total: 0 }] })),
    ]);

    res.json({
      schools: Number(schools.rows[0]?.count ?? 0),
      students: Number(students.rows[0]?.count ?? 0),
      teachersAndStaff: Number(teachers.rows[0]?.count ?? 0) + Number(staff.rows[0]?.count ?? 0),
      feesProcessed: Number(payments.rows[0]?.total ?? 0),
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({ error: 'Failed to load public stats' });
  }
});

// Resolve tenant - returns tenant info for branding (public)
router.get('/resolve', async (req: TenantRequest, res) => {
  try {
    if (req.tenant) {
      return res.json({
        success: true,
        tenant: {
          id: req.tenant.id,
          name: req.tenant.name,
          slug: req.tenant.slug,
          logo_url: req.tenant.logo_url,
          primary_color: req.tenant.primary_color,
          secondary_color: req.tenant.secondary_color,
          is_active: req.tenant.is_active,
        },
      });
    }
    res.json({ success: true, tenant: null });
  } catch (error) {
    console.error('Tenant resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant' });
  }
});

// Resolve by ID (public - for path /school/:id)
router.get('/by-id/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid tenant ID' });
    const tenant = await resolveTenantById(id);
    if (!tenant) return res.status(404).json({ error: 'School not found' });
    if (!tenant.is_active) return res.status(403).json({ error: 'School is not active' });
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      },
    });
  } catch (error) {
    console.error('Tenant by-id error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant' });
  }
});

// Resolve by slug (public - for path /s/:slug)
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) return res.status(400).json({ error: 'Slug required' });
    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) return res.status(404).json({ error: 'School not found' });
    if (!tenant.is_active) return res.status(403).json({ error: 'School is not active' });
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      },
    });
  } catch (error) {
    console.error('Tenant by-slug error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant' });
  }
});

export default router;
