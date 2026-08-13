// Rate limiting for the one non-static route (/api/sample). Two layers,
// both plain in-memory maps that reset on deploy:
//
// 1. A generous per-IP token bucket. Sanity guard against dumb loops, not
//    security: x-forwarded-for can be forged. Generous on purpose, so a
//    person clicking around all day never meets it.
// 2. A process-wide budget for UPSTREAM MISSES (lookups the signed-URL
//    cache cannot answer). The upstream sample-url allowance is a shared
//    ~1000 per rolling hour; without this, one caller enumerating ids
//    from the public catalog at the per-IP rate could starve playback for
//    everyone. Cache hits never touch this budget.
//
// The identity map is hard-bounded so forged addresses cannot grow it
// without limit: past the cap, the oldest bucket is evicted (Map keeps
// insertion order), and idle buckets are swept opportunistically.

const CAPACITY = 30; // per-IP burst
const REFILL_PER_MS = 30 / 60_000; // then 30 per minute
const IDLE_DROP_MS = 10 * 60 * 1000;
const MAX_BUCKETS = 5000;

type Bucket = { tokens: number; at: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [key, old] of buckets) {
        if (now - old.at > IDLE_DROP_MS) {
          buckets.delete(key);
          if (buckets.size < MAX_BUCKETS) break;
        }
      }
      // Still full of active entries: drop the oldest inserted.
      if (buckets.size >= MAX_BUCKETS) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
    }
    buckets.set(ip, { tokens: CAPACITY - 1, at: now });
    return { ok: true };
  }
  b.tokens = Math.min(CAPACITY, b.tokens + (now - b.at) * REFILL_PER_MS);
  b.at = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true };
  }
  return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / REFILL_PER_MS / 1000) };
}

// Upstream-miss budget: burst 100, then ~700 an hour, comfortably under
// the shared upstream allowance while irrelevant to organic browsing
// (cache hits bypass it, and a voice stays cached for 20 hours).
const MISS_CAPACITY = 100;
const MISS_REFILL_PER_MS = 700 / 3_600_000;
const missBucket: Bucket = { tokens: MISS_CAPACITY, at: Date.now() };

export function upstreamMissAllowed(): boolean {
  const now = Date.now();
  missBucket.tokens = Math.min(MISS_CAPACITY, missBucket.tokens + (now - missBucket.at) * MISS_REFILL_PER_MS);
  missBucket.at = now;
  if (missBucket.tokens >= 1) {
    missBucket.tokens -= 1;
    return true;
  }
  return false;
}
