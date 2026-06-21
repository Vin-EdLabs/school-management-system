import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { formatMoneyGhs, resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import {
  generateSingleInvoice,
  generateBulkInvoices,
  listInvoices,
  getInvoiceById,
  getInvoicePdfPayload,
} from '../services/invoiceService.js';

const router = express.Router();
const financeRoles = requireRole('super-admin', 'administrator', 'finance');

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

router.get('/', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = req.query.termId ? Number(req.query.termId) : null;
    const classId = req.query.classId ? Number(req.query.classId) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await listInvoices(tenantId, {
      termId: termId && !Number.isNaN(termId) ? termId : null,
      classId: classId && !Number.isNaN(classId) ? classId : null,
      status,
      limit,
      offset,
    });
    res.json(result);
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

router.get('/:id/pdf-data', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid invoice id' });

    const payload = await getInvoicePdfPayload(tenantId, id);
    if (!payload) return res.status(404).json({ error: 'Invoice not found' });
    res.json(payload);
  } catch (error) {
    console.error('Invoice PDF data error:', error);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
});

router.get('/:id', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid invoice id' });

    const invoice = await getInvoiceById(tenantId, id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});


router.post('/generate', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = Number(req.body.student_id ?? req.body.studentId);
    if (Number.isNaN(studentId)) return res.status(400).json({ error: 'student_id is required' });

    const termId = req.body.term_id ?? req.body.termId;
    const dueDate = req.body.due_date ?? req.body.dueDate ?? null;

    const result = await generateSingleInvoice(tenantId, studentId, {
      termId: termId != null ? Number(termId) : null,
      dueDate: dueDate ? String(dueDate) : null,
      generatedByUserId: req.user!.id,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        duplicate: 'This student already has an invoice for this term.',
        zero_balance: 'Nothing to invoice — balance is zero.',
        not_found: 'Student not found.',
        no_term: 'No active term configured.',
      };
      return res.status(400).json({ error: messages[result.reason] || 'Could not generate invoice' });
    }

    const inv = result.invoice;
    const actorName = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'INVOICE_GENERATED',
      entityType: 'invoice',
      entityId: inv.id,
      module: 'finance',
      status: 'success',
      summary: withActor(
        `Invoice generated — ${inv.invoiceNumber} for ${inv.studentName} (${formatMoneyGhs(inv.totalDue)})`,
        actorName
      ),
      details: {
        invoiceNumber: inv.invoiceNumber,
        studentName: inv.studentName,
        amount: inv.totalDue,
      },
      ipAddress: getClientIp(req),
    });

    res.status(result.refreshed ? 200 : 201).json({ ...inv, refreshed: result.refreshed ?? false });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

router.post('/generate-bulk', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = req.body.term_id ?? req.body.termId;
    const classId = req.body.class_id ?? req.body.classId;
    const dueDate = req.body.due_date ?? req.body.dueDate ?? null;

    const summary = await generateBulkInvoices(tenantId, {
      termId: termId != null ? Number(termId) : null,
      classId: classId != null && classId !== '' ? Number(classId) : null,
      dueDate: dueDate ? String(dueDate) : null,
      generatedByUserId: req.user!.id,
    });

    const actorName = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'INVOICE_BULK_GENERATED',
      entityType: 'invoice',
      entityId: null,
      module: 'finance',
      status: 'success',
      summary: withActor(
        `Bulk invoices — ${summary.generated} generated, ${summary.skipped} skipped (${formatMoneyGhs(summary.totalInvoicedAmount)})`,
        actorName
      ),
      details: {
        generated: summary.generated,
        skipped: summary.skipped,
        totalInvoicedAmount: summary.totalInvoicedAmount,
      },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(summary);
  } catch (error) {
    console.error('Bulk generate invoices error:', error);
    res.status(500).json({ error: 'Failed to generate bulk invoices' });
  }
});

export default router;
