import type { Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import type { AuthRequest } from './auth.js';
import { isTermClosingInProgress, isLedgerTermClosed } from '../services/termCloseService.js';
import { resolveLedgerTermFromSettings } from '../services/ledgerFinanceService.js';

const CLOSED_MSG =
  'This term has been closed and is read-only. No changes can be made to a closed term.';
const CLOSING_MSG =
  'A term is currently being closed. Please wait until the process completes.';
const ACTIVE_CLOSED_MSG =
  'The active term is closed. Activate an open term before making changes.';
const NO_ACTIVE_MSG =
  'No active term. Activate the next term in Settings → Academic Terms before making changes.';

function parseTermId(req: AuthRequest): number | null {
  const raw = req.body?.term_id ?? req.body?.termId ?? req.query?.term_id ?? req.query?.termId;
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseInt(String(raw), 10);
  return Number.isNaN(n) ? null : n;
}

function buildFullTermLabel(termName: string, year: string): string {
  const name = String(termName || '').trim();
  const y = String(year || '').trim();
  if (!y || name.includes(y)) return name;
  return `${name} ${y}`.trim();
}

async function resolveActiveLedgerTermId(tenantId: number): Promise<number | null> {
  const activeAcademicRes = await query(
    `SELECT term_name, year, ledger_term_id, closed_at
     FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true
     LIMIT 1`,
    [tenantId]
  );
  const activeAcademic = activeAcademicRes.rows[0];
  if (!activeAcademic || activeAcademic.closed_at) return null;

  if (activeAcademic.ledger_term_id != null) {
    return Number(activeAcademic.ledger_term_id);
  }

  const year = String(activeAcademic.year || '').trim();
  const fullLabel = buildFullTermLabel(activeAcademic.term_name, year);
  const resolved = await resolveLedgerTermFromSettings(tenantId, year, fullLabel);
  return resolved?.termId ?? null;
}

/**
 * Blocks write operations when the target term is closed or a close is in progress.
 */
export async function requireWritableTerm(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      next();
      return;
    }

    if (await isTermClosingInProgress(tenantId)) {
      res.status(403).json({ error: CLOSING_MSG, code: 'TERM_CLOSING' });
      return;
    }

    const activeLedgerId = await resolveActiveLedgerTermId(tenantId);

    if (activeLedgerId) {
      const activeLedgerRes = await query(
        `SELECT id, status FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [activeLedgerId, tenantId]
      );
      const activeLedger = activeLedgerRes.rows[0];
      if (!activeLedger) {
        res.status(403).json({ error: NO_ACTIVE_MSG, code: 'NO_ACTIVE_TERM' });
        return;
      }
      if (String(activeLedger.status) === 'closed') {
        res.status(403).json({ error: ACTIVE_CLOSED_MSG, code: 'ACTIVE_TERM_CLOSED' });
        return;
      }
    } else {
      const currentRes = await query(
        `SELECT id, status FROM terms WHERE tenant_id = $1 AND is_current = true LIMIT 1`,
        [tenantId]
      );
      const current = currentRes.rows[0];
      if (current && String(current.status) === 'closed') {
        res.status(403).json({ error: ACTIVE_CLOSED_MSG, code: 'ACTIVE_TERM_CLOSED' });
        return;
      }
      if (!current) {
        res.status(403).json({ error: NO_ACTIVE_MSG, code: 'NO_ACTIVE_TERM' });
        return;
      }
    }

    const termId = parseTermId(req);
    if (termId != null && (await isLedgerTermClosed(tenantId, termId))) {
      res.status(403).json({ error: CLOSED_MSG, code: 'TERM_CLOSED' });
      return;
    }

    next();
  } catch (err) {
    console.error('[requireWritableTerm]', err);
    res.status(500).json({ error: 'Failed to verify term status' });
  }
}
