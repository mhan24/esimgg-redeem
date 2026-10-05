/**
 * 订单序列化 (规格 §50: 不向用户暴露数据库 ID / 内部 API Response)
 */
import { transferErrorMessage } from "@/services/error-messages";
import { EsimApiError } from "@/lib/esim/errors";
import type { Order } from "@prisma/client";

export interface SerializedOrder {
  token: string;
  msisdn: string;
  numberPrice: string;
  initialBalance: string;
  recipientEmail: string | null;
  recipientAccountId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  purchasedAt: string | null;
  completedAt: string | null;
}

export function serializeOrder(order: Order): SerializedOrder {
  const transferFailure = order.status === "TRANSFER_FAILED"
    ? transferErrorMessage(new EsimApiError({
        message: order.errorMessage ?? "转移失败",
        errorCode: order.errorCode ?? undefined,
        kind: /timeout|network|uncertain/i.test(`${order.errorCode} ${order.errorMessage}`) ? "uncertain" : "definitive",
      }))
    : null;
  return {
    token: order.accessToken,
    msisdn: order.msisdn,
    numberPrice: order.numberPrice.toString(),
    initialBalance: order.initialBalance.toString(),
    recipientEmail: order.recipientEmail,
    recipientAccountId: order.recipientAccountId,
    status: order.status,
    errorCode: transferFailure?.code ?? order.errorCode,
    errorMessage: transferFailure?.message ?? order.errorMessage,
    createdAt: order.createdAt.toISOString(),
    purchasedAt: order.purchasedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
  };
}

/** 用户可见的脱敏邮箱 */
export function maskEmailForDisplay(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return email;
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}
