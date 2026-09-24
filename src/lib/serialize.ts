/**
 * 订单序列化 (规格 §50: 不向用户暴露数据库 ID / 内部 API Response)
 */
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
  return {
    token: order.accessToken,
    msisdn: order.msisdn,
    numberPrice: order.numberPrice.toString(),
    initialBalance: order.initialBalance.toString(),
    recipientEmail: order.recipientEmail,
    recipientAccountId: order.recipientAccountId,
    status: order.status,
    errorCode: order.errorCode,
    errorMessage: order.errorMessage,
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
