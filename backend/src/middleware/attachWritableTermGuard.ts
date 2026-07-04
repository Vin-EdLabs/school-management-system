import type { Router, Request, Response, NextFunction } from 'express';
import { requireWritableTerm } from './requireWritableTerm.js';
import { requireActiveTerm } from './requireActiveTerm.js';
import type { AuthRequest } from './auth.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type WritableTermGuardOptions = {
  /** Request paths that skip the active-term check (still enforce closed-term guard). */
  skipActiveTermPaths?: string[];
};

/** Attach write guards — blocks mutations when term is closed or not yet activated. */
export function attachWritableTermGuard(router: Router, options?: WritableTermGuardOptions): void {
  const skipActiveTermPaths = new Set(options?.skipActiveTermPaths ?? []);
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!MUTATION_METHODS.has(req.method)) {
      return next();
    }
    const skipActiveTerm =
      skipActiveTermPaths.has(req.path) ||
      (req.method === 'PATCH' && /\/status$/.test(req.path));
    requireWritableTerm(req as AuthRequest, res, () => {
      if (skipActiveTerm) {
        next();
        return;
      }
      requireActiveTerm(req as AuthRequest, res, next);
    });
  });
}
