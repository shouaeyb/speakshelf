// Per-IP token bucket for the one non-static route (/api/sample). This is
// a sanity guard against dumb loops, not security: x-forwarded-for can be
// forged and the buckets reset on deploy. Generous on purpose, so a person
// clicking around all day never meets it. The shared upstream budget is
// protected elsewhere, by the sample route's long signed-URL cache and its
// relay of upstream 429s.

const CAPACITY = 30; // burst
const REFILL_PER_MS = 30 / 60_000; // then 30 per minute
const IDLE_DROP_MS = 10 * 60 * 1000;
const SWEEP_AT = 2000; // buckets held before idle entries are swept

type Bucket = { tokens: number; at: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  if (buckets.size >= SWEEP_AT) {
    for (const [key, b] of buckets) {
      if (now - b.at > IDLE_DROP_MS) buckets.delete(key);
    }
  }
  const b = buckets.get(ip);
  if (!b) {
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
