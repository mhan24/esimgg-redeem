/**
 * 金额助手: 一律使用整数「分」计算, 避免浮点误差 (规格涉及 EUR 价格比较)
 */
import { Prisma } from "@prisma/client";

export type Eur = Prisma.Decimal | number | string;

/** EUR 十进制 -> 整数分 */
export function toCents(value: Eur): number {
  const d = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return d.mul(100).round().toNumber();
}

/** 整数分 -> 两位小数字符串 */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 解析用户输入金额 ("0.05" / "2" / "2.5") -> 分; 非法返回 null */
export function parseEurInput(input: unknown): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const str = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const cents = Math.round(Number(str) * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents;
}

/** esim.gg recharge_amount 需要字符串, 由分重建两位小数 */
export function rechargeAmountString(cents: number): string {
  return fromCents(cents);
}
