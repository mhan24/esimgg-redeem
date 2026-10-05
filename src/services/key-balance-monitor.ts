import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { refreshKeyBalance } from "./api-key-service";

export const BALANCE_CHECK_INTERVAL_MS = 5 * 60_000;

/** Claim each due key atomically so multiple server instances do not poll it together. */
export async function refreshDueKeyBalances(now = new Date()): Promise<void> {
  const due = { enabled: true, OR: [
    { balanceCheckStartedAt: null },
    { balanceCheckStartedAt: { lte: new Date(now.getTime() - BALANCE_CHECK_INTERVAL_MS) } },
  ] };
  const keys = await prisma.esimApiKey.findMany({ where: due, select: { id: true }, orderBy: { sortOrder: "asc" }, take: 100 });
  for (const key of keys) {
    const claimed = await prisma.esimApiKey.updateMany({ where: { id: key.id, ...due }, data: { balanceCheckStartedAt: now } });
    if (!claimed.count) continue;
    try {
      await refreshKeyBalance(key.id);
    } catch {
      logger.warn("定期检测 Key 余额失败", { keyId: key.id });
    }
  }
}

export function startKeyBalanceMonitor() {
  const state = globalThis as typeof globalThis & { keyBalanceMonitorStarted?: boolean };
  if (state.keyBalanceMonitorStarted) return;
  state.keyBalanceMonitorStarted = true;
  const tick = async () => {
    try { await refreshDueKeyBalances(); }
    catch { logger.warn("Key 余额定期检测暂时失败，将在下轮重试"); }
    // Wait until completion before scheduling again: slow requests cannot overlap.
    setTimeout(() => void tick(), 30_000).unref();
  };
  setTimeout(() => void tick(), 1000).unref();
  logger.info("Key 余额定期检测已启动", { intervalSeconds: BALANCE_CHECK_INTERVAL_MS / 1000 });
}
