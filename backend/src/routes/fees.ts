import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { postFeesForClass } from '../services/ledgerFinanceService.js';
import { ensureTenantLedgerSynced } from '../services/ledgerBackfillService.js';
import { writeAuditLog } from '../services/auditService.js';
import { formatMoneyGhs, resolveActorFromRequest, resolveClassName, withActor } from '../utils/auditResolve.js';
import { getClientIp } from '../utils/clientIp.js';
import { sqlBeneficiaryAdjustedAmount } from '../utils/beneficiaryFee.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { checkFeeStructureCompleteness } from '../services/feeStructureCheckService.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

/** Matches ledger term_fee recalculation when class fee totals change (param $4 = standard fee). */
const LEDGER_DEBIT_FROM_STANDARD_FEE = sqlBeneficiaryAdjustedAmount('$4').trim();

const FEE_SELECT = `
  SELECT lfs.*,
         c.class_name, c.level, c.stream,
         t.name AS ledger_term_name,
         ay.name AS academic_year_name,
         TRIM(CONCAT(t.name, ' ', ay.name)) AS term,
         COALESCE(
           (SELECT SUM(fsi.amount)::numeric
            FROM fee_structure_items fsi
            WHERE fsi.tenant_id = lfs.tenant_id
              AND fsi.fee_structure_id = lfs.id
              AND fsi.is_active = true),
           lfs.total,
           0
         ) AS effective_total
  FROM ledger_fee_structures lfs
  LEFT JOIN classes c ON lfs.class_id = c.id
  LEFT JOIN terms t ON lfs.term_id = t.id
  LEFT JOIN academic_years ay ON lfs.academic_year_id = ay.id
`;

const mapFeeRow = (row: Record<string, unknown>) => ({
  ...row,
  amount:
    row.effective_total != null
      ? Number(row.effective_total)
      : row.total != null
        ? Number(row.total)
        : 0,
  term: String(row.term || '').trim(),
  due_date: null,
  description: row.description ?? null,
});

async function resolveTermIds(
  tenantId: number,
  _termRaw?: string
): Promise<{ academicYearId: number; termId: number } | null> {
  const active = await resolveActiveLedgerTerm(query, tenantId);
  if (active.ledgerTermId && active.academicYearId) {
    return { academicYearId: active.academicYearId, termId: active.ledgerTermId };
  }
  return null;
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

// Get all fee structures (ledger-only)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    const rawTermId = req.query.term_id ?? req.query.termId;

    let queryText = `${FEE_SELECT} WHERE lfs.tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (classId) {
      queryText += ` AND lfs.class_id = $${params.length + 1}`;
      params.push(classId);
    }

    let ledgerTermId: number | null = null;
    if (rawTermId != null && String(rawTermId).trim() !== '') {
      const parsed = parseInt(String(rawTermId), 10);
      if (!Number.isNaN(parsed)) ledgerTermId = parsed;
    }
    if (ledgerTermId == null) {
      const active = await resolveActiveLedgerTerm(query, tenantId);
      ledgerTermId = active.ledgerTermId;
    }
    if (ledgerTermId == null) {
      return res.json([]);
    }
    queryText += ` AND lfs.term_id = $${params.length + 1}`;
    params.push(ledgerTermId);

    queryText += ' ORDER BY lfs.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows.map(mapFeeRow));
  } catch (error) {
    console.error('Get fee structures error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
});

// POST /api/fees/sync-ledger — bill students missing term_fee rows for the active term (idempotent)
router.post('/sync-ledger', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await ensureTenantLedgerSynced(tenantId);
    res.json({
      message: 'Ledger sync completed (term fees and payment credits backfilled where missing).',
    });
  } catch (error) {
    console.error('Sync ledger fees error:', error);
    res.status(500).json({ error: 'Failed to sync student ledger fees' });
  }
});

// GET /api/fees/structure-check — verify all in-use classes have fee structures for the active term
router.get('/structure-check', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rawLedgerTermId = req.query.term_id ?? req.query.termId ?? req.query.ledger_term_id;
    const ledgerTermId =
      rawLedgerTermId != null && String(rawLedgerTermId).trim() !== ''
        ? parseInt(String(rawLedgerTermId), 10)
        : undefined;

    const result = await checkFeeStructureCompleteness(tenantId, {
      ledgerTermId:
        ledgerTermId != null && !Number.isNaN(ledgerTermId) ? ledgerTermId : undefined,
    });

    return res.json({
      complete: result.complete,
      total_classes: result.total_classes,
      configured_classes: result.configured_classes,
      missing_classes: result.missing_classes,
      term_id: result.term_id,
    });
  } catch (error) {
    console.error('Fee structure check error:', error);
    res.status(500).json({ error: 'Failed to check fee structure completeness' });
  }
});

// GET /api/fees/archives — list archived fee structures from closed terms
router.get('/archives', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { listFeeStructureArchives } = await import('../services/feeStructureArchiveService.js');
    const archives = await listFeeStructureArchives(tenantId);
    res.json(archives);
  } catch (error) {
    console.error('List fee archives error:', error);
    res.status(500).json({ error: 'Failed to list archived fee structures' });
  }
});

// GET /api/fees/archives/latest — most recent archived term fees (view only until reuse)
router.get('/archives/latest', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { getLatestFeeStructureArchive } = await import('../services/feeStructureArchiveService.js');
    const archive = await getLatestFeeStructureArchive(tenantId);
    if (!archive) {
      return res.json(null);
    }
    res.json(archive);
  } catch (error) {
    console.error('Latest fee archive error:', error);
    res.status(500).json({ error: 'Failed to load archived fee structure' });
  }
});

/** Previous terms / archives that can be copied into the active term. */
router.get('/copy-sources', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { listFeeStructureCopySources } = await import('../services/feeStructureArchiveService.js');
    const sources = await listFeeStructureCopySources(tenantId);
    res.set('Cache-Control', 'no-store');
    res.json(sources);
  } catch (error) {
    console.error('List fee copy sources error:', error);
    res.status(500).json({ error: 'Failed to list previous fee setups' });
  }
});

router.get('/copy-sources/:sourceType/:sourceId', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const sourceType = String(req.params.sourceType || '') === 'archive' ? 'archive' : 'term';
    const sourceId = parseInt(req.params.sourceId, 10);
    if (Number.isNaN(sourceId)) {
      return res.status(400).json({ error: 'Invalid source id' });
    }
    const { getFeeStructuresForCopySource } = await import('../services/feeStructureArchiveService.js');
    const detail = await getFeeStructuresForCopySource(tenantId, sourceType, sourceId);
    res.set('Cache-Control', 'no-store');
    res.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load fee setup';
    console.error('Get fee copy source error:', error);
    res.status(400).json({ error: message });
  }
});

router.post(
  '/copy-from-term/:sourceTermId',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const sourceTermId = parseInt(req.params.sourceTermId, 10);
      if (Number.isNaN(sourceTermId)) {
        return res.status(400).json({ error: 'Invalid source term id' });
      }
      const targetTermId =
        req.body?.term_id != null ? parseInt(String(req.body.term_id), 10) : undefined;
      const billStudents =
        req.body?.bill_students === true || req.body?.billStudents === true;

      const { copyFeeStructuresFromTerm } = await import('../services/feeStructureArchiveService.js');
      const result = await copyFeeStructuresFromTerm(
        tenantId,
        sourceTermId,
        targetTermId != null && !Number.isNaN(targetTermId) ? targetTermId : undefined,
        { billStudents }
      );

      emitTenantDataChanged(tenantId, 'fee', 'created');

      res.json({
        message:
          result.structuresCopied > 0
            ? billStudents
              ? `Copied ${result.structuresCopied} fee structure(s) from ${result.sourceTermLabel} and billed students.`
              : `Copied ${result.structuresCopied} fee structure(s) from ${result.sourceTermLabel}. Students were not billed.`
            : 'No new structures copied — classes may already be configured for this term.',
        ...result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to copy fee structures';
      console.error('Copy fee from term error:', error);
      res.status(400).json({ error: message });
    }
  }
);

// GET /api/fees/archives/:archiveId — view archived fee structure details
router.get('/archives/:archiveId', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const archiveId = parseInt(req.params.archiveId, 10);
    if (Number.isNaN(archiveId)) {
      return res.status(400).json({ error: 'Invalid archive id' });
    }
    const { getFeeStructureArchive } = await import('../services/feeStructureArchiveService.js');
    const archive = await getFeeStructureArchive(tenantId, archiveId);
    if (!archive) {
      return res.status(404).json({ error: 'Archived fee structure not found' });
    }
    res.json(archive);
  } catch (error) {
    console.error('Get fee archive error:', error);
    res.status(500).json({ error: 'Failed to load archived fee structure' });
  }
});

// POST /api/fees/archives/:archiveId/reuse — apply archived fees to active term and bill students
router.post(
  '/archives/:archiveId/reuse',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const archiveId = parseInt(req.params.archiveId, 10);
      if (Number.isNaN(archiveId)) {
        return res.status(400).json({ error: 'Invalid archive id' });
      }
      const targetTermId =
        req.body?.term_id != null ? parseInt(String(req.body.term_id), 10) : undefined;
      const billStudents =
        req.body?.bill_students === true || req.body?.billStudents === true;

      const { reuseArchivedFeeStructures } = await import('../services/feeStructureArchiveService.js');
      const result = await reuseArchivedFeeStructures(
        tenantId,
        archiveId,
        targetTermId != null && !Number.isNaN(targetTermId) ? targetTermId : undefined,
        { billStudents }
      );

      emitTenantDataChanged(tenantId, 'fee', 'created');

      res.json({
        message:
          result.structuresCopied > 0
            ? billStudents
              ? `Reused ${result.structuresCopied} fee structure(s) from ${result.sourceTermLabel} and billed students.`
              : `Copied ${result.structuresCopied} fee structure(s) from ${result.sourceTermLabel}. Students were not billed — set fees or bill manually when ready.`
            : 'No new structures copied — classes may already be configured for this term.',
        ...result,
      });
    } catch (error) {
      console.error('Reuse fee archive error:', error);
      const message = error instanceof Error ? error.message : 'Failed to reuse archived fee structure';
      res.status(500).json({ error: message });
    }
  }
);

// Get single fee structure
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      `${FEE_SELECT} WHERE lfs.id = $1 AND lfs.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    res.json(mapFeeRow(result.rows[0]));
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure' });
  }
});

// Create fee structure (ledger-only)
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { class_id, term, amount, description } = req.body;

    if (!class_id || !term || amount == null) {
      return res.status(400).json({ error: 'Class ID, term, and amount are required' });
    }

    const classIdNum = Number(class_id);
    const amountNum = Number(amount);
    if (Number.isNaN(classIdNum) || Number.isNaN(amountNum)) {
      return res.status(400).json({ error: 'Invalid class or amount' });
    }

    const resolved = await resolveTermIds(tenantId);
    if (!resolved) {
      return res.status(400).json({
        error: 'No active ledger term. Set an academic term as active before saving fee structures.',
      });
    }

    const { academicYearId, termId } = resolved;

    const result = await query(
      `INSERT INTO ledger_fee_structures (tenant_id, class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total)
       VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
       ON CONFLICT (tenant_id, class_id, academic_year_id, term_id)
       DO UPDATE SET tuition_fee = EXCLUDED.tuition_fee, total = EXCLUDED.total
       RETURNING *`,
      [tenantId, classIdNum, academicYearId, termId, amountNum]
    );

    await postFeesForClass(tenantId, classIdNum, academicYearId, termId);

    const rowRes = await query(`${FEE_SELECT} WHERE lfs.id = $1 AND lfs.tenant_id = $2`, [
      result.rows[0].id,
      tenantId,
    ]);
    const mappedRow = rowRes.rows[0] ?? result.rows[0];
    const fs = mapFeeRow(mappedRow);
    const className = String((mappedRow as Record<string, unknown>).class_name || (await resolveClassName(tenantId, classIdNum))).trim();
    const termLabel = String(fs.term || term).trim();
    const actor = await resolveActorFromRequest(req);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_CREATE',
      entityType: 'FEE_STRUCTURE',
      entityId: Number(result.rows[0].id),
      module: 'finance',
      status: 'success',
      summary: withActor(
        `Fee structure created for ${className} — ${formatMoneyGhs(amount)} for ${termLabel}`,
        actor
      ),
      details: { fee_structure: fs, className, term: termLabel, description: description ?? null },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    emitTenantDataChanged(tenantId, 'fee', 'created');
    res.status(201).json(fs);
  } catch (error) {
    console.error('Create fee structure error:', error);
    res.status(500).json({ error: 'Failed to create fee structure' });
  }
});

// Update fee structure
router.put('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;

    const oldRes = await query(`${FEE_SELECT} WHERE lfs.id = $1 AND lfs.tenant_id = $2`, [id, tenantId]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const previous = oldRes.rows[0] as Record<string, unknown>;
    const activeResolved = await resolveTermIds(tenantId);
    if (!activeResolved) {
      return res.status(400).json({
        error: 'No active ledger term. Cannot update fee structures until a term is active.',
      });
    }

    const existingTermId = Number(previous.term_id);
    if (!Number.isNaN(existingTermId) && existingTermId !== activeResolved.termId) {
      return res.status(400).json({
        error: 'This fee structure belongs to a closed or previous term. Create a new structure for the active term instead.',
      });
    }

    const classIdNum = updates.class_id != null ? Number(updates.class_id) : Number(previous.class_id);
    const amountNum = updates.amount != null ? Number(updates.amount) : Number(previous.total);

    if (Number.isNaN(classIdNum) || Number.isNaN(amountNum)) {
      return res.status(400).json({ error: 'Invalid class or amount' });
    }

    const { academicYearId, termId } = activeResolved;

    const result = await query(
      `UPDATE ledger_fee_structures
       SET class_id = $1, academic_year_id = $2, term_id = $3,
           tuition_fee = $4, total = $4, pta_fee = 0, exam_fee = 0
       WHERE tenant_id = $5 AND id = $6
       RETURNING *`,
      [classIdNum, academicYearId, termId, amountNum, tenantId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    await query(
      `UPDATE student_ledger AS sl
       SET debit = ${LEDGER_DEBIT_FROM_STANDARD_FEE}
       FROM students AS s
       WHERE sl.student_id = s.id
         AND sl.tenant_id = $1
         AND sl.term_id = $2
         AND sl.entry_type = 'term_fee'
         AND s.tenant_id = $1
         AND s.class_assigned_id = $3`,
      [tenantId, termId, classIdNum, amountNum]
    );
    await postFeesForClass(tenantId, classIdNum, academicYearId, termId);

    const rowRes = await query(`${FEE_SELECT} WHERE lfs.id = $1 AND lfs.tenant_id = $2`, [id, tenantId]);
    const next = mapFeeRow(rowRes.rows[0] ?? result.rows[0]);
    const prevAmt = previous.total != null ? Number(previous.total) : null;
    const nextAmt = next.amount != null ? Number(next.amount) : null;
    const mappedNext = rowRes.rows[0] ?? result.rows[0];
    const className = String(
      (mappedNext as Record<string, unknown>).class_name ||
        previous.class_name ||
        (await resolveClassName(tenantId, classIdNum))
    ).trim();
    const termLabel = String(next.term || '').trim();
    const actor = await resolveActorFromRequest(req);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_UPDATE',
      entityType: 'FEE_STRUCTURE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary: withActor(
        prevAmt != null && nextAmt != null && prevAmt !== nextAmt
          ? `Fee structure updated for ${className} — amount changed from ${formatMoneyGhs(prevAmt)} to ${formatMoneyGhs(nextAmt)} (${termLabel})`
          : `Fee structure updated for ${className} — ${termLabel}`,
        actor
      ),
      details: { fee_structure_id: parseInt(id, 10), className, term: termLabel, previous, new: next },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    emitTenantDataChanged(tenantId, 'fee', 'updated');
    res.json(next);
  } catch (error) {
    console.error('Update fee structure error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update fee structure';
    res.status(500).json({ error: 'Failed to update fee structure', detail: message });
  }
});

// Delete fee structure
router.delete('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const feeResult = await query(`${FEE_SELECT} WHERE lfs.id = $1 AND lfs.tenant_id = $2`, [id, tenantId]);
    if (feeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const deleted = feeResult.rows[0] as Record<string, any>;
    const { class_id: classId, term_id: ledgerTermId } = deleted;

    const paymentsCheck = await query(
      `SELECT COUNT(*) as count FROM payments p
       JOIN students s ON p.student_id = s.id
       WHERE p.tenant_id = $1 AND s.class_assigned_id = $2
         AND p.term_id = $3 AND COALESCE(p.is_voided, false) = false`,
      [tenantId, classId, ledgerTermId]
    ).catch(async () =>
      query(
        `SELECT COUNT(*) as count FROM payments p
         JOIN students s ON p.student_id = s.id
         WHERE p.tenant_id = $1 AND s.class_assigned_id = $2
           AND COALESCE(p.is_voided, false) = false`,
        [tenantId, classId]
      )
    );
    const paymentCount = parseInt(paymentsCheck.rows[0]?.count || '0', 10);
    if (paymentCount > 0) {
      return res.status(400).json({
        error: `Cannot delete fee structure because ${paymentCount} payment(s) are already recorded for this class/term.`,
      });
    }

    await query(
      `DELETE FROM student_ledger sl
       USING students s
       WHERE sl.student_id = s.id
         AND sl.tenant_id = $1
         AND sl.term_id = $2
         AND sl.entry_type = 'term_fee'
         AND sl.credit = 0
         AND s.class_assigned_id = $3`,
      [tenantId, ledgerTermId, classId]
    );

    const result = await query(
      'DELETE FROM ledger_fee_structures WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    const className = String(deleted.class_name || 'Unknown class').trim();
    const termLabel = String(deleted.term || '').trim();
    const actor = await resolveActorFromRequest(req);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_DELETE',
      entityType: 'FEE_STRUCTURE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary: withActor(
        `Fee structure deleted for ${className}${termLabel ? ` — ${termLabel}` : ''}`,
        actor
      ),
      details: { fee_structure_id: parseInt(id, 10), className, term: termLabel, deleted_record: deleted },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    emitTenantDataChanged(tenantId, 'fee', 'deleted');
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
});

export default router;
