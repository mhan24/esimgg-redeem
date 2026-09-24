/**
 * GET /api/admin/dashboard (规格 §5/§71)
 * 新增: 官方实付成本统计 (costTotal) 与 API Key 余额/低余额预警
 */
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { callWithKeys } from "@/services/esim-gateway";
import { listApiKeyViews } from "@/services/api-key-service";
import { EsimApiError } from "@/lib/esim/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      codeTotal,
      codeUnused,
      codeLocked,
      codePurchased,
      codeUsed,
      codeDisabled,
      orderTotal,
      orderToday,
      orderPurchaseUncertain,
      orderTransferFailed,
      orderCompleted,
      purchaseSum,
      initialSum,
      costSum,
      costCount,
      settings,
      keys,
    ] = await Promise.all([
      prisma.redeemCode.count(),
      prisma.redeemCode.count({ where: { status: "UNUSED" } }),
      prisma.redeemCode.count({ where: { status: "LOCKED" } }),
      prisma.redeemCode.count({ where: { status: "PURCHASED" } }),
      prisma.redeemCode.count({ where: { status: "USED" } }),
      prisma.redeemCode.count({ where: { status: "DISABLED" } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { status: "PURCHASE_UNCERTAIN" } }),
      prisma.order.count({ where: { status: "TRANSFER_FAILED" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.aggregate({
        _sum: { numberPrice: true },
        where: { purchasedAt: { not: null } },
      }),
      prisma.order.aggregate({
        _sum: { initialBalance: true },
        where: { completedAt: { not: null } },
      }),
      // 官方实付成本 (规格 §71)
      prisma.order.aggregate({ _sum: { costTotal: true } }),
      prisma.order.count({ where: { costTotal: { not: null } } }),
      prisma.systemSetting.findUnique({ where: { id: 1 } }),
      listApiKeyViews(),
    ]);

    // Wallet 余额 (实时, 规格 §5) — 经多 Key 网关获取
    let wallet: { currency: string; balance: number } | null = null;
    let walletError: string | null = null;
    try {
      const call = await callWithKeys({
        task: (client) => client.getWalletBalance("eur"),
      });
      wallet = call.value;
    } catch (e) {
      walletError =
        e instanceof EsimApiError
          ? e.message
          : "未配置 API Key 或连接失败";
    }

    const threshold = Number(settings?.keyLowBalanceThreshold ?? 2.99);
    const lowBalanceKeys = keys.filter(
      (k) =>
        k.enabled &&
        k.lastBalance !== null &&
        Number(k.lastBalance) < threshold,
    );

    return jsonOk({
      wallet,
      walletError,
      codes: {
        total: codeTotal,
        unused: codeUnused,
        locked: codeLocked,
        purchased: codePurchased,
        used: codeUsed,
        disabled: codeDisabled,
      },
      orders: {
        total: orderTotal,
        today: orderToday,
        purchaseUncertain: orderPurchaseUncertain,
        transferFailed: orderTransferFailed,
        completed: orderCompleted,
      },
      amounts: {
        numberPurchase: purchaseSum._sum.numberPrice?.toString() ?? "0.00",
        initialBalanceSpend: initialSum._sum.initialBalance?.toString() ?? "0.00",
        /** 官方实付成本合计 (规格 §71) */
        actualCost: costSum._sum.costTotal?.toString() ?? "0.00",
        actualCostOrders: costCount,
        /** 预估合计 (号码价格 + 初始余额), 用于对比 */
        estimatedCost: (
          Number(purchaseSum._sum.numberPrice ?? 0) +
          Number(initialSum._sum.initialBalance ?? 0)
        ).toFixed(2),
      },
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        maskedKey: k.maskedKey,
        enabled: k.enabled,
        lastBalance: k.lastBalance,
        lowBalance:
          k.enabled && k.lastBalance !== null && Number(k.lastBalance) < threshold,
      })),
      keyStrategy: settings?.keyStrategy ?? "sequential",
      keyLowBalanceThreshold: threshold.toFixed(2),
      lowBalanceKeys: lowBalanceKeys.map((k) => ({
        id: k.id,
        name: k.name,
        lastBalance: k.lastBalance,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
