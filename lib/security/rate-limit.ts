type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const RATE_LIMIT_MESSAGE = "Too many requests. Please try again shortly.";

export function memoryRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfterMs: 0, backend: "memory" as const };
  }

  if (current.count >= limit) {
    return { success: false, remaining: 0, retryAfterMs: current.resetAt - now, backend: "memory" as const };
  }

  current.count += 1;
  return { success: true, remaining: limit - current.count, retryAfterMs: 0, backend: "memory" as const };
}

function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisRateLimit(key: string, limit: number, windowMs: number) {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const encodedKey = encodeURIComponent(`rl:${key}`);
  const headers = { Authorization: `Bearer ${token}` };
  const incr = await fetch(`${base}/incr/${encodedKey}`, { headers, cache: "no-store" });
  if (!incr.ok) throw new Error("rate_limit_unavailable");
  const body = (await incr.json()) as { result?: number };
  const count = Number(body.result ?? 0);
  if (count === 1) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    await fetch(`${base}/expire/${encodedKey}/${seconds}`, { headers, cache: "no-store" });
  }
  if (count > limit) {
    return { success: false, remaining: 0, retryAfterMs: windowMs, backend: "redis" as const };
  }
  return { success: true, remaining: Math.max(0, limit - count), retryAfterMs: 0, backend: "redis" as const };
}

export async function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  if (redisConfigured()) {
    try {
      return await redisRateLimit(key, limit, windowMs);
    } catch {
      if (process.env.NODE_ENV === "production" && process.env.CALACE_ALLOW_MEMORY_RATE_LIMIT !== "true") {
        return { success: false, remaining: 0, retryAfterMs: windowMs, backend: "redis" as const };
      }
    }
  } else if (process.env.NODE_ENV === "production" && process.env.CALACE_ALLOW_MEMORY_RATE_LIMIT !== "true") {
    return { success: false, remaining: 0, retryAfterMs: windowMs, backend: "unconfigured" as const };
  }
  return memoryRateLimit(key, limit, windowMs);
}

export function rateLimitConfigured() {
  return redisConfigured();
}

export function rateLimitKey(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":");
}
