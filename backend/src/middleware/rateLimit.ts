import type { NextFunction, Request, Response } from 'express';
import { getRateLimitMaxRequests, getRateLimitWindowMs } from '../config/security.js';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function createInMemoryRateLimiter(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.RATE_LIMIT_ENABLED !== 'false';
  const windowMs = getRateLimitWindowMs(env);
  const maxRequests = getRateLimitMaxRequests(env);
  const buckets = new Map<string, RateLimitBucket>();

  return function inMemoryRateLimiter(req: Request, res: Response, next: NextFunction): void {
    if (!enabled) {
      next();
      return;
    }

    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    next();
  };
}
