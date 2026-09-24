/**
 * Ownership Transfer 服务 (规格 §28-§31, §61)
 *
 * 不变量:
 * - 仅 PURCHASED / TRANSFER_FAILED 状态可转移
 * - 转移前确认号码仍在平台账户 (规格 §31)
 * - 转移失败绝不重新购买, 只允许换邮箱/账户 ID 重试 (原则 3)
 * - 成功: Order -> COMPLETED, RedeemCode -> USED
 */
import { prisma } from "@/lib/prisma";
import { EsimApiError } from "@/lib/esim/errors";
import { transferErrorMessage } from "./error-messages";
import { callWithKeys } from "./esim-gateway";
import {
  ApiError,
  badRequest,
  conflict,
  notFound,
} from "@/lib/http";
import { Prisma } from "@prisma/client";
import type { Order } from "@prisma/client";

export interface TransferOptions {
  recipientEmail?: string;
  recipientAccountId?: string;
}

/** 订单完成: COMPLETED + 卡密 USED (规格 §31) */
async function completeOrder(
  order: Order,
  transferResponse: unknown,
): Promise<Order> {
  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        transferResponse: (transferResponse ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        errorCode: null,
        errorMessage: null,
      },
    }),
    // 卡密 LOCKED/PURCHASED -> USED (规格 §16)
    prisma.redeemCode.updateMany({
      where: { id: order.redeemCodeId, status: { in: ["LOCKED", "PURCHASED"] } },
      data: { status: "USED", usedAt: now },
    }),
  ]);
  return updated;
}

/** 标记转移失败 (卡密保持 PURCHASED, 规格 §30) */
async function markTransferFailed(
  orderId: string,
  err: EsimApiError | null,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "TRANSFER_FAILED",
      errorCode: err?.errorCode ?? "TRANSFER_ERROR",
      errorMessage: err?.message ?? "转移失败",
    },
  });
}

export async function transferOrder(
  orderId: string,
  opts: TransferOptions = {},
): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("订单不存在");
  if (order.status !== "PURCHASED" && order.status !== "TRANSFER_FAILED") {
    throw conflict("ORDER_NOT_TRANSFERABLE", "当前订单状态不能执行转移");
  }

  const recipientEmail = (opts.recipientEmail ?? order.recipientEmail ?? "").trim();
  const recipientAccountId = (
    opts.recipientAccountId ??
    order.recipientAccountId ??
    ""
  ).trim();
  if (!recipientEmail && !recipientAccountId) {
    throw badRequest("RECIPIENT_REQUIRED", "请填写接收邮箱或账户 ID");
  }
  if (recipientEmail && recipientAccountId) {
    throw badRequest("RECIPIENT_CONFLICT", "邮箱与账户 ID 只能二选一");
  }

  // 必须用购买时的 Key (号码在该 Key 的账户下, 规格 §71)
  // 1. 确认号码仍属于平台账户 (规格 §31)
  let stillOwned: boolean;
  try {
    const check = await callWithKeys({
      fixedKeyId: order.apiKeyId,
      task: (client) => client.ownsLine(order.msisdn),
    });
    stillOwned = check.value;
  } catch (e) {
    // 配置类错误 (购买时使用的 Key 已被删除等) 原样抛出, 便于管理员定位
    if (e instanceof ApiError) throw e;
    const err = e instanceof EsimApiError ? e : null;
    await markTransferFailed(orderId, err);
    throw new ApiError(
      503,
      "OWNERSHIP_CHECK_FAILED",
      "暂时无法确认号码归属，请稍后重试。不会重复购买号码。",
    );
  }
  if (!stillOwned) {
    // 号码已不在平台账户: 上一次转移实际已成功 (响应丢失场景), 直接完成
    return completeOrder(order, {
      reconciled: true,
      reason: "号码已不在平台账户，判定转移已完成",
    });
  }

  // 2. 标记 TRANSFERRING 并更新接收方
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "TRANSFERRING",
      recipientEmail: recipientEmail || null,
      recipientAccountId: recipientAccountId || null,
      errorCode: null,
      errorMessage: null,
      retryCount: { increment: 1 },
    },
  });

  // 3. 调用转移 API (规格 §28) — 与归属检查使用同一个 Key
  try {
    const transfer = await callWithKeys({
      fixedKeyId: order.apiKeyId,
      task: (client) =>
        client.transferOwnership({
          msisdn: order.msisdn,
          recipientEmail: recipientEmail || undefined,
          recipientAccountId: recipientAccountId || undefined,
        }),
    });
    return await completeOrder(order, transfer.value);
  } catch (e) {
    const err = e instanceof EsimApiError ? e : null;
    await markTransferFailed(orderId, err);
    const friendly = transferErrorMessage(err);
    throw new ApiError(502, friendly.code, friendly.message);
  }
}
