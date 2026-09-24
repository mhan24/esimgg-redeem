/**
 * 内存固定窗口 Rate Limiter (规格 §42: V1 小规模部署可用内存限流器)
 * 单实例部署适用; 多实例水平扩展时应替换为 Redis。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** 窗口计数: windowMs 内最多 limit 次 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
  };
}

/** 两次请求最小间隔 (规格 §11: 最短搜索间隔 3 秒) */
export function minInterval(
  key: string,
  intervalMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);
  if (bucket && bucket.resetAt > now) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  store.set(key, { count: 1, resetAt: now + intervalMs });
  return { ok: true, retryAfterSec: 0 };
}

/** 测试辅助: 清空所有窗口 */
export function resetRateLimits() {
  store.clear();
}
