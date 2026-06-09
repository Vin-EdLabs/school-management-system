import { Request, Response, NextFunction } from 'express';
import { captureSystemError } from '../services/systemErrorService.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);
  
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    const tenantIdHeader = req.headers['x-tenant-id'];
    const tenantId = tenantIdHeader ? Number(tenantIdHeader) : null;
    captureSystemError({
      message,
      stack: err.stack || null,
      source: 'backend',
      tenantId: Number.isFinite(tenantId) ? tenantId : null,
      endpoint: req.originalUrl || req.url,
      action: `${req.method} ${req.path}`,
      severity: 'critical',
      metadata: {
        statusCode: status,
        ip: req.ip,
      },
    }).catch(() => undefined);
  }
  
  res.status(status).json({ error: message });
};
