/**
 * 单元测试: 限流器 (规格 §11/§42/§43)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, minInterval, resetRateLimits } from "@/lib/ratelimit";

describe("ratelimit", () => {
  beforeEach(() => resetRateLimits());

  it("窗口内超过限制被拒绝", () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimit("k", 10, 60_000).ok).toBe(true);
    }
    const r = rateLimit("k", 10, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("不同 key 互不影响", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("b", 5, 60_000).ok).toBe(true);
  });

  it("最小间隔: 间隔内第二次被拒绝 (规格 §11: 3 秒)", () => {
    expect(minInterval("s", 3000).ok).toBe(true);
    const second = minInterval("s", 3000);
    expect(second.ok).toBe(false);
    expect(second.retryAfterSec).toBeLessThanOrEqual(3);
  });
});
