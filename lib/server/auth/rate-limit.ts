// ---------------------------------------------------------------------------
// Minimal in-process login-attempt limiter. Enough to blunt obvious credential
// stuffing in a single-instance dev/foundation deployment. It is intentionally
// NOT distributed — a horizontally-scaled production deployment must move this
// to a shared store (Redis / Postgres) or an edge rate limiter. Documented as a
// known follow-up (see Phase 16.5 report §42).
// ---------------------------------------------------------------------------

type Bucket = { count: number; firstAt: number; blockedUntil: number };

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // per key per window
const BLOCK_MS = 15 * 60 * 1000;

const buckets = new Map<string, Bucket>();

export type RateResult = { allowed: boolean; retryAfterSec?: number };

export function checkLoginRate(key: string): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) return { allowed: true };
  if (b.blockedUntil > now) return { allowed: false, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
  if (now - b.firstAt > WINDOW_MS) {
    buckets.delete(key);
    return { allowed: true };
  }
  if (b.count >= MAX_ATTEMPTS) {
    b.blockedUntil = now + BLOCK_MS;
    return { allowed: false, retryAfterSec: Math.ceil(BLOCK_MS / 1000) };
  }
  return { allowed: true };
}

/** Record a failed attempt against a key. */
export function registerFailure(key: string): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.firstAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  b.count += 1;
}

/** Clear a key's attempts after a successful login. */
export function registerSuccess(key: string): void {
  buckets.delete(key);
}
