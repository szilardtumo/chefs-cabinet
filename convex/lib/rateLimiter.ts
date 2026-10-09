import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { components } from '../_generated/api';
import { ValidationError } from './errors';

/** Per-user limits on functions that call paid or quota-limited APIs, or fill storage. */
const rateLimiter = new RateLimiter(components.rateLimiter, {
  unsplashSearch: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 15 },
  catalogSearch: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 20 },
  bookImport: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
  upload: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 20 },
  recipeAi: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
});

export async function enforceRateLimit(
  ctx: Parameters<typeof rateLimiter.limit>[0] & { userId: string },
  name: keyof NonNullable<typeof rateLimiter.limits>,
) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key: ctx.userId });
  if (!ok) {
    throw new ValidationError(`Too many requests. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`);
  }
}
