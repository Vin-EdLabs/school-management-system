import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { checkFeeStructureCompleteness } from '../services/feeStructureCheckService.js';

const FEE_STRUCTURE_INCOMPLETE_RESPONSE = (missing: { id: string; name: string }[]) => ({
  success: false,
  code: 'FEE_STRUCTURE_INCOMPLETE',
  message:
    'Fee structures have not been set for all classes this term. Configure them before recording payments.',
  missing_classes: missing,
});

/**
 * Blocks fee payment recording when any class lacks a fee structure for the active term.
 */
export async function requireCompleteFeeStructures(
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

    const rawTermId = req.body?.term_id ?? req.body?.termId ?? req.query?.term_id ?? req.query?.termId;
    const termId =
      rawTermId != null && String(rawTermId).trim() !== ''
        ? parseInt(String(rawTermId), 10)
        : undefined;

    const result = await checkFeeStructureCompleteness(
      tenantId,
      termId != null && !Number.isNaN(termId) ? termId : undefined
    );

    if (result.complete) {
      next();
      return;
    }

    res.status(403).json(FEE_STRUCTURE_INCOMPLETE_RESPONSE(result.missing_classes));
  } catch (err) {
    console.error('[requireCompleteFeeStructures]', err);
    res.status(500).json({ success: false, error: 'Failed to verify fee structure completeness' });
  }
}
