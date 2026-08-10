import { NextFunction, Request, Response } from 'express';

type CachedResponse = {
  statusCode: number;
  contentType?: string;
  body: unknown;
  expiresAt: number;
  pending: boolean;
};

const IDEMPOTENCY_TTL_MS = 30_000;
const cache = new Map<string, CachedResponse>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) cache.delete(key);
  }
}

setInterval(cleanupExpired, IDEMPOTENCY_TTL_MS).unref?.();

export function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

  const header = req.header('X-Idempotency-Key');
  if (!header) return next();

  const key = `${req.method}:${req.originalUrl}:${header}`;
  const existing = cache.get(key);

  if (existing?.pending) {
    return res.status(409).json({
      error: 'This request is already processing. Please wait.',
      duplicate: true,
    });
  }

  if (existing && existing.expiresAt > Date.now() && existing.statusCode < 400) {
    if (existing.contentType) res.type(existing.contentType);
    return res.status(existing.statusCode).send(existing.body as any);
  }

  cache.set(key, {
    statusCode: 202,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    pending: true,
    body: null,
  });

  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (res.statusCode < 500) {
      cache.set(key, {
        statusCode: res.statusCode,
        contentType: res.getHeader('content-type')?.toString(),
        body,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        pending: false,
      });
    } else {
      cache.delete(key);
    }
    return originalSend(body);
  }) as typeof res.send;

  res.on('close', () => {
    const current = cache.get(key);
    if (current?.pending) cache.delete(key);
  });

  return next();
}
