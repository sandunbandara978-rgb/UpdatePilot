/**
 * In-memory sliding-window rate limiter for sensitive authentication & pairing endpoints.
 * Protects against brute-force attacks and denial-of-service attempts.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();

  /**
   * Check whether the key has exceeded maxAttempts within the given windowMs.
   */
  check(key: string, maxAttempts: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetInMs: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxAttempts - 1, resetInMs: windowMs };
    }

    if (entry.count >= maxAttempts) {
      return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
    }

    entry.count += 1;
    return { allowed: true, remaining: maxAttempts - entry.count, resetInMs: entry.resetAt - now };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

export const rateLimiter = new MemoryRateLimiter();

