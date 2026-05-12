import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { postFeesForClass } from '../services/ledgerFinanceService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

const splitTermAndYear = (termRaw: string, fallbackYear?: string): { termName: string; yearName: string | null } => {
  const raw = String(termRaw || '').trim();
  const yearMatch = raw.match(/(19|20)\d{2}$/);
  const yearName = yearMatch?.[0] || (fallbackYear ? String(fallbackYear) : null);
  const termName = yearMatch ? raw.replace(/\s+(19|20)\d{2}$/, '').trim() : raw;
  return { termName, yearName };
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Get all fee structures
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, term } = req.query;
    
    let queryText = `
      SELECT fs.*, c.class_name, c.level, c.stream
      FROM fee_structures fs
      LEFT JOIN classes c ON fs.class_id = c.id
      WHERE fs.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (classId) {
      queryText += ' AND fs.class_id = $2';
      params.push(classId);
      if (term) {
        queryText += ' AND fs.term = $3';
        params.push(term);
      }
    } else if (term) {
      queryText += ' AND fs.term = $2';
      params.push(term);
    }
    
    queryText += ' ORDER BY fs.created_at DESC';
    
    let result;
    try {
      result = await query(queryText, params);
    } catch {
      // Legacy schema fallback: fee_structures may not have tenant_id.
      let legacyQuery = `
        SELECT fs.*, c.class_name, c.level, c.stream
        FROM fee_structures fs
        LEFT JOIN classes c ON fs.class_id = c.id
        WHERE c.tenant_id = $1
      `;
      const legacyParams: any[] = [tenantId];
      if (classId) {
        legacyQuery += ` AND fs.class_id = $${legacyParams.length + 1}`;
        legacyParams.push(classId);
      }
      if (term) {
        legacyQuery += ` AND fs.term = $${legacyParams.length + 1}`;
        legacyParams.push(term);
      }
      legacyQuery += ' ORDER BY fs.created_at DESC';
      result = await query(legacyQuery, legacyParams);
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Get fee structures error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
});

// Get single fee structure
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    let result;
    try {
      result = await query(
        `SELECT fs.*, c.class_name, c.level, c.stream
         FROM fee_structures fs
         LEFT JOIN classes c ON fs.class_id = c.id
         WHERE fs.id = $1 AND fs.tenant_id = $2`,
        [id, tenantId]
      );
    } catch {
      result = await query(
        `SELECT fs.*, c.class_name, c.level, c.stream
         FROM fee_structures fs
         LEFT JOIN classes c ON fs.class_id = c.id
         WHERE fs.id = $1 AND c.tenant_id = $2`,
        [id, tenantId]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure' });
  }
});

// Create fee structure
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { class_id, term, amount, due_date, description } = req.body;
    
    if (!class_id || !term || !amount) {
      return res.status(400).json({ error: 'Class ID, term, and amount are required' });
    }
    
    let result;
    const nameValue = (description && String(description).trim()) || String(term);
    const attempts: Array<{ sql: string; params: any[] }> = [
      {
        sql: `INSERT INTO fee_structures (tenant_id, class_id, term, amount, due_date, description)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        params: [tenantId, class_id, term, amount, due_date || null, description || null],
      },
      {
        sql: `INSERT INTO fee_structures (class_id, term, amount, due_date, description)
              VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        params: [class_id, term, amount, due_date || null, description || null],
      },
      {
        sql: `INSERT INTO fee_structures (tenant_id, class_id, name, amount, due_date, description)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        params: [tenantId, class_id, nameValue, amount, due_date || null, description || null],
      },
      // Prefer writing term when table supports it so newly created rows
      // immediately appear in active-term views.
      {
        sql: `INSERT INTO fee_structures (tenant_id, class_id, name, term, amount, due_date, description)
              VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        params: [tenantId, class_id, nameValue, term, amount, due_date || null, description || null],
      },
      {
        sql: `INSERT INTO fee_structures (class_id, name, amount, due_date, description)
              VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        params: [class_id, nameValue, amount, due_date || null, description || null],
      },
    ];
    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        result = await query(attempt.sql, attempt.params);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!result) {
      throw lastError || new Error('Failed to create fee structure on legacy schema');
    }
    
    const fs = result.rows[0] as Record<string, unknown>;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_CREATE',
      entityType: 'FEE_STRUCTURE',
      entityId: Number(fs.id),
      module: 'finance',
      status: 'success',
      summary: `Fee structure created — class ${class_id}, term ${term}, GHS ${amount}`,
      details: { fee_structure: fs },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    // Keep ledger finance in sync so students are billed immediately after fee setup.
    try {
      const classIdNum = Number(class_id);
      const amountNum = Number(amount);
      if (!Number.isNaN(classIdNum) && !Number.isNaN(amountNum)) {
        const settingsRes = await query(
          'SELECT current_year FROM school_settings WHERE tenant_id = $1 LIMIT 1',
          [tenantId]
        );
        const fallbackYear = settingsRes.rows[0]?.current_year ? String(settingsRes.rows[0].current_year) : undefined;
        const { termName, yearName } = splitTermAndYear(String(term), fallbackYear);

        if (termName && yearName) {
          const yearRes = await query(
            `INSERT INTO academic_years (tenant_id, name, is_current)
             VALUES ($1, $2, false)
             ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [tenantId, yearName]
          );
          const academicYearId = yearRes.rows[0]?.id;

          if (academicYearId) {
            const termRes = await query(
              `INSERT INTO terms (tenant_id, academic_year_id, name, is_current)
               VALUES ($1, $2, $3, false)
               ON CONFLICT (tenant_id, academic_year_id, name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [tenantId, academicYearId, termName]
            );
            const termId = termRes.rows[0]?.id;

            if (termId) {
              await query(
                `INSERT INTO ledger_fee_structures (tenant_id, class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total)
                 VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
                 ON CONFLICT (tenant_id, class_id, academic_year_id, term_id)
                 DO UPDATE SET tuition_fee = EXCLUDED.tuition_fee, total = EXCLUDED.total`,
                [tenantId, classIdNum, academicYearId, termId, amountNum]
              );
              await postFeesForClass(tenantId, classIdNum, academicYearId, termId);
            }
          }
        }
      }
    } catch (syncError) {
      console.error('[fees] Ledger sync/auto-bill warning:', syncError);
    }

    // Automatically refresh arrears when fee structure is created
    const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
    await refreshArrearsForTenant(tenantId).catch(err => console.error('Auto-sync arrears error:', err));
    
    emitTenantDataChanged(tenantId, 'fee', 'created');
    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    
    res.status(201).json(result.rows[0]);
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
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['class_id', 'term', 'amount', 'due_date', 'description'];
    
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

    const oldRes = await query('SELECT * FROM fee_structures WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const previous = oldRes.rows[0] as Record<string, unknown>;
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    const result = await query(
      `UPDATE fee_structures SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const next = result.rows[0] as Record<string, unknown>;
    const prevAmt = previous.amount != null ? Number(previous.amount) : null;
    const nextAmt = next.amount != null ? Number(next.amount) : null;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_UPDATE',
      entityType: 'FEE_STRUCTURE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary:
        prevAmt != null && nextAmt != null && prevAmt !== nextAmt
          ? `Fee structure amount changed from GHS ${prevAmt} to GHS ${nextAmt}`
          : `Fee structure #${id} updated`,
      details: {
        fee_structure_id: parseInt(id, 10),
        previous,
        new: next,
        changed_fields: Object.keys(updates).filter((k) => allowedFields.includes(k)),
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    // Keep ledger in sync with edited fee (same as create path) so reports and ledger balances match Set Fees.
    try {
      const row = result.rows[0];
      const classIdNum = Number(row.class_id);
      const amountNum = parseFloat(String(row.amount ?? '0'));
      const termStr = String(row.term || '').trim();
      if (!Number.isNaN(classIdNum) && termStr && !Number.isNaN(amountNum)) {
        const settingsRes = await query(
          'SELECT current_year FROM school_settings WHERE tenant_id = $1 LIMIT 1',
          [tenantId]
        );
        const fallbackYear = settingsRes.rows[0]?.current_year ? String(settingsRes.rows[0].current_year) : undefined;
        const { termName, yearName } = splitTermAndYear(termStr, fallbackYear);
        if (termName && yearName) {
          const yearRes = await query(
            `INSERT INTO academic_years (tenant_id, name, is_current)
             VALUES ($1, $2, false)
             ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [tenantId, yearName]
          );
          const academicYearId = yearRes.rows[0]?.id;
          if (academicYearId) {
            const termRes = await query(
              `INSERT INTO terms (tenant_id, academic_year_id, name, is_current)
               VALUES ($1, $2, $3, false)
               ON CONFLICT (tenant_id, academic_year_id, name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [tenantId, academicYearId, termName]
            );
            const termId = termRes.rows[0]?.id;
            if (termId) {
              await query(
                `INSERT INTO ledger_fee_structures (tenant_id, class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total)
                 VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
                 ON CONFLICT (tenant_id, class_id, academic_year_id, term_id)
                 DO UPDATE SET tuition_fee = EXCLUDED.tuition_fee, total = EXCLUDED.total`,
                [tenantId, classIdNum, academicYearId, termId, amountNum]
              );
              await query(
                `UPDATE student_ledger AS sl
                 SET debit = CASE
                   WHEN s.is_beneficiary = true AND s.discount_type = 'percentage' THEN $4::numeric - ($4::numeric * COALESCE(s.discount_value, 0) / 100)
                   WHEN s.is_beneficiary = true AND s.discount_type = 'fixed' THEN GREATEST(0, $4::numeric - COALESCE(s.discount_value, 0))
                   ELSE $4::numeric
                 END
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
            }
          }
        }
      }
    } catch (syncError) {
      console.error('[fees] Ledger sync on update warning:', syncError);
    }

    // Automatically refresh arrears when fee structure is updated
    const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
    await refreshArrearsForTenant(tenantId).catch(err => console.error('Auto-sync arrears error:', err));
    
    emitTenantDataChanged(tenantId, 'fee', 'updated');
    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update fee structure error:', error);
    res.status(500).json({ error: 'Failed to update fee structure' });
  }
});

// Delete fee structure (with validation: block if payments exist for this class/term)
router.delete('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    // Get fee structure to find class_id and term
    const feeResult = await query(
      'SELECT class_id, term FROM fee_structures WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (feeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const { class_id, term } = feeResult.rows[0];

    // Check if any other fee structures exist for this class/term
    const otherStructures = await query(
      'SELECT id FROM fee_structures WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND id != $4',
      [tenantId, class_id, term, id]
    );

    // ONLY block if this is the LAST fee structure for this class/term and payments exist
    if (otherStructures.rows.length === 0) {
      const paymentsCheck = await query(
        `SELECT COUNT(*) as count FROM payments p
         JOIN students s ON p.student_id = s.id
         WHERE p.tenant_id = $1 AND s.class_assigned_id = $2
         AND (p.term = $3 OR p.term LIKE $4)`,
        [tenantId, class_id, term, `${term}%`]
      );
      const paymentCount = parseInt(paymentsCheck.rows[0]?.count || '0');
      if (paymentCount > 0) {
        return res.status(400).json({
          error: `Cannot delete the ONLY fee structure for this class/term because ${paymentCount} payment(s) are already recorded. Delete or adjust payments first if you must remove it.`,
        });
      }
    }
    
    const result = await query(
      'DELETE FROM fee_structures WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const deleted = result.rows[0] as Record<string, unknown>;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_STRUCTURE_DELETE',
      entityType: 'FEE_STRUCTURE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary: `Fee structure deleted (class ${String(deleted.class_id ?? '')}, term ${String(deleted.term ?? '')})`,
      details: { fee_structure_id: parseInt(id, 10), deleted_record: deleted },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    // Automatically refresh arrears when fee structure is deleted
    const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
    await refreshArrearsForTenant(tenantId).catch(err => console.error('Auto-sync arrears error:', err));
    
    emitTenantDataChanged(tenantId, 'fee', 'deleted');
    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
});

export default router;
