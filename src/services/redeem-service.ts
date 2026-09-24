/**
 * 卡密验证服务 (规格 §20-§21)
 */
import { prisma } from "@/lib/prisma";
import { ApiError, forbidden, notFound } from "@/lib/http";
import { serializeOrder, type SerializedOrder } from "@/lib/serialize";
import type { Order, RedeemCode } from "@prisma/client";

const STALE_LOCK_MS = 30 * 60 * 1000; // 超过 30 分钟的陈旧锁

export type VerifyResult =
  | { kind: "READY"; codeId: string; code: string }
  | {
      kind: "RESUME";
      codeId: string;
      code: string;
      order: SerializedOrder;
      canRetryTransfer: boolean;
    }
  | {
      kind: "COMPLETED";
      codeId: string;
      code: string;
      order: SerializedOrder;
    };

/** 规范化卡密: 去空白、大写 */
export function normalizeCode(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase();
}

async function latestActiveOrder(codeId: string): Promise<Order | null> {
  return prisma.order.findFirst({
    where: {
      redeemCodeId: codeId,
      status: { notIn: ["FAILED"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function verifyCode(rawCode: string): Promise<VerifyResult> {
  const code = normalizeCode(rawCode);
  if (!code) throw notFound("卡密不存在");

  const redeemCode: RedeemCode | null = await prisma.redeemCode.findUnique({
    where: { code },
  });
  if (!redeemCode) throw notFound("卡密不存在");
  if (redeemCode.status === "DISABLED") {
    throw forbidden("卡密已被禁用，请联系管理员");
  }
  if (redeemCode.expiresAt && redeemCode.expiresAt.getTime() < Date.now()) {
    throw forbidden("卡密已过期");
  }

  const base = { codeId: redeemCode.id, code: redeemCode.code };
  const order = await latestActiveOrder(redeemCode.id);

  switch (redeemCode.status) {
    case "UNUSED":
      return { kind: "READY", ...base };

    case "LOCKED": {
      if (order) {
        // 恢复进行中的订单 (规格 §21): PURCHASE_UNCERTAIN / TRANSFER_FAILED 等
        return {
          kind: "RESUME",
          ...base,
          order: serializeOrder(order),
          canRetryTransfer:
            order.status === "TRANSFER_FAILED" || order.status === "PURCHASED",
        };
      }
      // 无订单的陈旧锁: 释放 (例如进程在建单前中断)
      if (
        redeemCode.lockedAt &&
        redeemCode.lockedAt.getTime() < Date.now() - STALE_LOCK_MS
      ) {
        await prisma.redeemCode.updateMany({
          where: { id: redeemCode.id, status: "LOCKED" },
          data: { status: "UNUSED", lockedAt: null },
        });
        return { kind: "READY", ...base };
      }
      throw new ApiError(409, "CODE_IN_PROGRESS", "卡密正在处理中，请稍后再试");
    }

    case "PURCHASED": {
      if (!order) {
        throw new ApiError(409, "ORDER_MISSING", "订单异常，请联系管理员");
      }
      // 规格 §21: 不能提示"已使用", 应恢复订单继续转移
      return {
        kind: "RESUME",
        ...base,
        order: serializeOrder(order),
        canRetryTransfer: true,
      };
    }

    case "USED": {
      if (!order) {
        throw new ApiError(409, "ORDER_MISSING", "订单异常，请联系管理员");
      }
      return { kind: "COMPLETED", ...base, order: serializeOrder(order) };
    }

    default:
      throw new ApiError(409, "CODE_NOT_USABLE", "卡密状态不允许兑换");
  }
}
