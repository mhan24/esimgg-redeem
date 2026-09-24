/**
 * 购买服务 (规格 §24-§27, §60)
 *
 * 完整状态机:
 *   PENDING -> PURCHASING -> PURCHASED -> TRANSFERRING -> COMPLETED
 *   PURCHASING -> PURCHASE_UNCERTAIN (结果未知且 /line/all 未命中, 等人工)
 *   PURCHASING -> FAILED (明确失败, 同时释放卡密 LOCKED -> UNUSED)
 *
 * 核心原则:
 * - 卡密 UNUSED -> LOCKED 必须原子条件更新 (规格 §17)
 * - 价格来自 NumberSearchSession, 不信任客户端 (原则 5)
 * - 购买超时/不确定响应必须先 /line/all 对账, 绝不自动重买 (原则 4)
 * - 确认购买成功后退不回 UNUSED (原则 2)
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { transferOrder } from "./transfer-service";
import { purchaseErrorMessage } from "./error-messages";
import { buildCostBreakdown } from "@/lib/esim/cost";
import { EsimApiError } from "@/lib/esim/errors";
import {
  callWithKeys,
  isInsufficientBalanceError,
} from "./esim-gateway";
import type { ResolvedKey } from "./api-key-service";
import {
  ApiError,
  badRequest,
  conflict,
  notFound,
  serverError,
} from "@/lib/http";
import { fromCents, toCents } from "@/lib/money";
import { Prisma } from "@prisma/client";
import type { Order, SystemSetting } from "@prisma/client";

export interface StartRedemptionParams {
  codeId: string;
  msisdn: string;
  recipientEmail?: string;
  recipientAccountId?: string;
}

/** 事务内: 原子锁卡密 + 全部购买前安全检查 + 创建订单 (规格 §17/§25) */
async function createOrderTransactional(
  params: StartRedemptionParams,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    // 1. 原子锁卡密: 仅 UNUSED 可锁 (规格 §17, 禁止 SELECT-then-UPDATE)
    const lock = await tx.redeemCode.updateMany({
      where: { id: params.codeId, status: "UNUSED" },
      data: { status: "LOCKED", lockedAt: new Date() },
    });
    if (lock.count === 0) {
      throw conflict("CODE_NOT_AVAILABLE", "卡密状态不允许兑换或已被使用");
    }

    // 2. 系统设置检查 (规格 §25)
    const settings: SystemSetting | null = await tx.systemSetting.findUnique({
      where: { id: 1 },
    });
    if (!settings) throw serverError("系统设置缺失");
    if (!settings.allowFreeNumbers && !settings.allowPaidNumbers) {
      throw badRequest("SELECTION_CLOSED", "当前暂未开放号码兑换。");
    }

    // 3. Search Session 检查 (规格 §12/§13)
    const session = await tx.numberSearchSession.findFirst({
      where: {
        redeemCodeId: params.codeId,
        msisdn: params.msisdn,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      throw badRequest("SEARCH_SESSION_EXPIRED", "选号会话已过期，请重新搜索号码");
    }

    // 4. 价格校验 (规格 §25 / 原则 6/7) — 使用服务端会话中的真实价格
    const priceCents = toCents(session.price);
    const maxCents = toCents(settings.maxPaidNumberPrice);
    if (!settings.allowPaidNumbers && priceCents > 0) {
      throw badRequest("PAID_NOT_ALLOWED", "当前仅支持免费号码");
    }
    if (settings.allowPaidNumbers && priceCents > maxCents) {
      throw badRequest("PRICE_TOO_HIGH", "号码价格超过允许上限");
    }

    const recipientEmail = (params.recipientEmail ?? "").trim() || null;
    const recipientAccountId =
      (params.recipientAccountId ?? "").trim() || null;

    // 5. 创建订单 (快照 number_price / initial_balance, 原则 9)
    return tx.order.create({
      data: {
        redeemCodeId: params.codeId,
        msisdn: params.msisdn,
        numberPrice: session.price,
        initialBalance: settings.initialBalance,
        recipientEmail,
        recipientAccountId,
        accessToken: randomBytes(24).toString("base64url"),
        status: "PENDING",
      },
    });
  });
}

/** 明确失败: 订单 FAILED + 释放卡密 LOCKED -> UNUSED (规格 §18) */
async function failPurchase(
  order: Order,
  friendly: { code: string; message: string },
  detail?: unknown,
): Promise<never> {
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        errorCode: friendly.code,
        errorMessage: friendly.message,
        ...(detail !== undefined
          ? { purchaseResponse: detail as Prisma.InputJsonValue }
          : {}),
      },
    }),
    prisma.redeemCode.updateMany({
      where: { id: order.redeemCodeId, status: "LOCKED" },
      data: { status: "UNUSED", lockedAt: null },
    }),
  ]);
  throw new ApiError(409, friendly.code, friendly.message);
}

/** 确认购买成功: 订单 PURCHASED + 卡密 LOCKED -> PURCHASED (规格 §16/§18) */
async function markPurchased(
  order: Order,
  purchaseResponse: unknown,
  usedKey?: ResolvedKey,
): Promise<void> {
  const now = new Date();
  // 官方实付成本 (规格 §71): 以购买响应 total_price 为准
  const breakdown = buildCostBreakdown(purchaseResponse, {
    numberPrice: order.numberPrice.toString(),
    initialBalance: order.initialBalance.toString(),
  });
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PURCHASED",
        purchasedAt: now,
        purchaseResponse: (purchaseResponse ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ...(usedKey && !usedKey.legacy ? { apiKeyId: usedKey.id } : {}),
        ...(breakdown
          ? {
              costTotal: breakdown.total,
              costBreakdown: breakdown as unknown as Prisma.InputJsonValue,
            }
          : {}),
        errorCode: null,
        errorMessage: null,
      },
    }),
    prisma.redeemCode.updateMany({
      where: { id: order.redeemCodeId, status: "LOCKED" },
      data: { status: "PURCHASED" },
    }),
  ]);
}

/**
 * 用户确认兑换入口: 锁卡密 -> 建单 -> 购买 -> (对账) -> 转移
 */
export async function startRedemption(
  params: StartRedemptionParams,
): Promise<Order> {
  const order = await createOrderTransactional(params);
  return executePurchase(order);
}

/**
 * 执行购买流程 (PENDING -> ... )
 * 多 API Key (规格 §71): 余额不足自动切换; 结果未知绝不切换 (原则 4)
 */
export async function executePurchase(order: Order): Promise<Order> {
  if (order.status !== "PENDING") {
    // 幂等: 已开始/已结束的订单直接返回当前状态
    return order;
  }

  const needCents = toCents(order.numberPrice) + toCents(order.initialBalance);

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PURCHASING" },
  });

  // 购买 (规格 §24): 余额预检 + 购买 + 故障转移由网关统一处理
  let purchaseRaw: unknown;
  // 记录实际发起购买的 Key: 即使响应不确定, 对账命中后也必须用同一个 Key 转移
  let usedKey: ResolvedKey | undefined;
  try {
    const result = await callWithKeys({
      minBalanceCents: needCents,
      switchOnDefinitive: isInsufficientBalanceError,
      task: (client, key) => {
        usedKey = key;
        return client.purchaseNumber({
          msisdn: order.msisdn,
          rechargeAmount: fromCents(toCents(order.initialBalance)),
        });
      },
    });
    purchaseRaw = result.value.raw;
    usedKey = result.key;
  } catch (e) {
    if (e instanceof ApiError && e.code === "ALL_KEYS_INSUFFICIENT") {
      // 所有 Key 余额都不足: 明确失败, 释放卡密 (规格 §18/§41)
      await failPurchase(order, {
        code: "WALLET_INSUFFICIENT",
        message: "系统余额不足，请联系管理员。",
      });
    }
    if (e instanceof ApiError && e.code === "API_KEY_MISSING") {
      await failPurchase(order, {
        code: "API_KEY_MISSING",
        message: "购买时使用的 API Key 已被删除，请联系管理员。",
      });
    }
    if (e instanceof EsimApiError && e.kind === "definitive") {
      // 明确失败: 释放卡密, 并保存真实 API 错误供管理员排查 (规格 §7/§18)
      await failPurchase(order, purchaseErrorMessage(e), {
        esimError: {
          statusCode: e.statusCode ?? null,
          errorCode: e.errorCode ?? null,
          message: e.message,
        },
      });
    }
    // 结果未知 (timeout/网络/5xx/429): 进入对账 (规格 §26/§27)
    const err = e instanceof EsimApiError ? e : null;
    let owned = false;
    try {
      const check = await callWithKeys({
        fixedKeyId: order.apiKeyId,
        task: (client) => client.ownsLine(order.msisdn),
      });
      owned = check.value;
    } catch {
      owned = false;
    }
    if (owned) {
      // 对账命中: 视为购买成功, 绝不重买 (原则 4)
      // 仍记录实际购买的 Key, 保证后续转移使用同一账户
      await markPurchased(
        order,
        {
          reconciled: true,
          reason: "购买响应不确定, /line/all 对账命中",
        },
        usedKey,
      );
    } else {
      // 未命中: PURCHASE_UNCERTAIN, 卡密保持 LOCKED, 等待人工处理
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PURCHASE_UNCERTAIN",
          errorCode: err?.errorCode ?? "PURCHASE_UNCERTAIN",
          errorMessage: err?.message ?? "购买结果未知",
        },
      });
      throw new ApiError(
        409,
        "PURCHASE_UNCERTAIN",
        "购买结果正在核实中，请稍后刷新查看或联系管理员。不会重复扣费。",
      );
    }
  }

  await markPurchased(order, purchaseRaw, usedKey);

  // 购买成功 -> 转移 (规格 §60)
  const fresh = await prisma.order.findUnique({ where: { id: order.id } });
  if (!fresh) throw notFound("订单不存在");
  return transferOrder(fresh.id, {
    recipientEmail: fresh.recipientEmail ?? undefined,
    recipientAccountId: fresh.recipientAccountId ?? undefined,
  });
}

/**
 * 异常订单人工确认 (规格 §27/§40)
 * 管理员核实号码已在平台账户后, 将 PURCHASE_UNCERTAIN -> PURCHASED 并继续转移。
 * 二次确认由 API 调用方 (后台 UI) 完成。
 */
export async function reconcilePurchase(
  orderId: string,
  adminId: string,
): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("订单不存在");
  if (order.status !== "PURCHASE_UNCERTAIN") {
    throw conflict("NOT_UNCERTAIN", "仅购买结果不确定的订单可执行对账");
  }
  // 必须用购买时的 Key 对账 (号码在该 Key 的账户下, 规格 §71)
  const check = await callWithKeys({
    fixedKeyId: order.apiKeyId,
    task: (client) => client.ownsLine(order.msisdn),
  });
  if (!check.value) {
    throw conflict(
      "LINE_NOT_OWNED",
      "号码不在平台账户中，无法确认购买成功，请人工核实",
    );
  }
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PURCHASED",
      purchasedAt: new Date(),
      purchaseResponse: {
        reconciled: true,
        reason: "管理员人工对账确认",
        adminId,
      },
    },
  });
  await prisma.redeemCode.updateMany({
    where: { id: order.redeemCodeId, status: "LOCKED" },
    data: { status: "PURCHASED" },
  });
  return transferOrder(order.id, {
    recipientEmail: order.recipientEmail ?? undefined,
    recipientAccountId: order.recipientAccountId ?? undefined,
  });
}
