import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), claim: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { esimApiKey: { findMany: mocks.find, updateMany: mocks.claim } } }));
vi.mock("@/services/api-key-service", () => ({ refreshKeyBalance: mocks.refresh }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
import { refreshDueKeyBalances, startKeyBalanceMonitor } from "@/services/key-balance-monitor";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.refresh.mockResolvedValue({ balance: 2.99 });
});
afterEach(() => vi.useRealTimers());
it("filters enabled keys and claims only checks older than five minutes", async () => {
  const now = new Date("2026-10-02T10:00:00Z");
  await refreshDueKeyBalances(now);
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: {
    enabled: true, OR: [{ balanceCheckStartedAt: null }, { balanceCheckStartedAt: { lte: new Date("2026-10-02T09:55:00Z") } }],
  } }));
  expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ data: { balanceCheckStartedAt: now } }));
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});
it("skips a key another instance already claimed", async () => {
  mocks.claim.mockResolvedValueOnce({ count: 0 });
  await refreshDueKeyBalances();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.refresh).toHaveBeenCalledWith("b");
});
it("continues checking other keys after one request fails", async () => {
  mocks.refresh.mockRejectedValueOnce(new Error("unavailable"));
  await expect(refreshDueKeyBalances()).resolves.toBeUndefined();
  expect(mocks.refresh).toHaveBeenCalledWith("b");
});
it("starts once and schedules another cycle after a failure", async () => {
  vi.useFakeTimers();
  mocks.find.mockRejectedValueOnce(new Error("database unavailable"));
  startKeyBalanceMonitor(); startKeyBalanceMonitor();
  await vi.advanceTimersByTimeAsync(1000);
  expect(mocks.find).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30000);
  expect(mocks.find).toHaveBeenCalledTimes(2);
  vi.clearAllTimers();
});
