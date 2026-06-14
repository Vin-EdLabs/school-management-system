import express from 'express';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  addBudgetCategory,
  closeTermBudget,
  createTermBudget,
  deleteBudgetCategory,
  evaluateBudgetAlerts,
  getActiveBudget,
  getSetupPrefill,
  getUnreadBudgetAlerts,
  listBudgetCategories,
  listBudgetHistory,
  markAllBudgetAlertsRead,
  markBudgetAlertRead,
  renameBudgetCategory,
  updateTermBudgetLines,
} from '../services/termBudgetService.js';

const router = express.Router();
const budgetRoles = requireRole('super-admin', 'administrator', 'finance');
const adminOnly = requireRole('super-admin', 'administrator');

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/categories', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const type = req.query.type as 'income' | 'expense' | undefined;
    const categories = await listBudgetCategories(tenantId, type);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch categories' });
  }
});

router.post('/categories', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, type } = req.body;
    const category = await addBudgetCategory(
      tenantId,
      req.user!.id,
      req.user!.role,
      name,
      type,
      getClientIp(req)
    );
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to add category' });
  }
});

router.patch('/categories/:id', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name } = req.body;
    await renameBudgetCategory(tenantId, parseInt(req.params.id, 10), name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to rename category' });
  }
});

router.delete('/categories/:id', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await deleteBudgetCategory(tenantId, parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to delete category' });
  }
});

router.get('/setup-prefill', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const copyFromLast = req.query.copyFromLast === 'true';
    const data = await getSetupPrefill(tenantId, copyFromLast);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load setup prefill' });
  }
});

router.get('/current', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const data = await getActiveBudget(
      tenantId,
      req.query.academicYear as string | undefined,
      req.query.term as string | undefined
    );
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch budget' });
  }
});

router.get('/history', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const history = await listBudgetHistory(tenantId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch budget history' });
  }
});

router.post('/', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Budget lines are required' });
    }
    const data = await createTermBudget(
      tenantId,
      req.user!.id,
      req.user!.role,
      lines,
      getClientIp(req)
    );
    res.status(201).json(data);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create budget' });
  }
});

router.put('/:id/lines', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const budgetId = parseInt(req.params.id, 10);
    const { lines } = req.body;
    if (!Array.isArray(lines)) {
      return res.status(400).json({ error: 'Lines array is required' });
    }
    const data = await updateTermBudgetLines(
      tenantId,
      req.user!.id,
      req.user!.role,
      budgetId,
      lines,
      getClientIp(req)
    );
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update budget' });
  }
});

router.post('/:id/close', adminOnly, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const budgetId = parseInt(req.params.id, 10);
    const data = await closeTermBudget(
      tenantId,
      req.user!.id,
      req.user!.role,
      budgetId,
      getClientIp(req)
    );
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to close budget' });
  }
});

router.get('/alerts/unread', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const alerts = await getUnreadBudgetAlerts(tenantId);
    res.json({ alerts, count: alerts.length });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch alerts' });
  }
});

router.post('/alerts/:id/read', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await markBudgetAlertRead(tenantId, parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to mark alert read' });
  }
});

router.post('/alerts/read-all', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await markAllBudgetAlertsRead(tenantId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to mark alerts read' });
  }
});

router.post('/evaluate-alerts', budgetRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await evaluateBudgetAlerts(tenantId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to evaluate alerts' });
  }
});

export default router;
