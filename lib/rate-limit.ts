// Rate limiter sederhana in-memory. Untuk production multi-instance di Vercel,
// ganti dengan Upstash Redis. Ini cukup untuk MVP single-region.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > limit;
}