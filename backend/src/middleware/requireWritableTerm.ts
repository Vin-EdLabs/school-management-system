import type { Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import type { AuthRequest } from './auth.js';
import { isTermClosingInProgress, isLedgerTermClosed } from '../services/termCloseService.js';

const CLOSED_MSG =
  'This term has been closed and is read-only. No changes can be made to a closed term.';
const CLOSING_MSG =
  'A term is currently being closed. Please wait until the process completes.';

function parseTermId(req: AuthRequest): number | null {
  const raw = req.body?.term_id ?? req.body?.termId ?? req.query?.term_id ?? req.query?.termId;
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseInt(String(raw), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Blocks write operations when the target term is closed or a close is in progress.
 * Apply to all financial and term-linked mutation routes.
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

    const currentRes = await query(
      `SELECT id, status FROM terms WHERE tenant_id = $1 AND is_current = true LIMIT 1`,
      [tenantId]
    );
    const current = currentRes.rows[0];
    if (current && String(current.status) === 'closed') {
      res.status(403).json({
        error: 'The active term is closed. Activate an open term before making changes.',
        code: 'ACTIVE_TERM_CLOSED',
      });
      return;
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
