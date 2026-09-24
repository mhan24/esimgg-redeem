/**
 * 官方实付成本解析 (规格 §71)
 *
 * 权威来源: POST /checkout/new_line 的响应。实测该接口返回:
 *   { "success": true, "vat_amount": 0, "total_price": 2.99,
 *     "number_price": 0, "redirect_url": "..." }
 *
 * 注意: 系统内快照的 numberPrice/initialBalance 是「预估」,
 * 与 API 实收可能不一致 (实测出现过预估 0.50 / 实付 2.99),
 * 因此统计一律以 total_price 为准。
 */

export interface PurchaseCost {
  /** 实付总额 (EUR) */
  total: number | null;
  /** 号码费用 (EUR) */
  numberPrice: number | null;
  /** 增值税 (EUR) */
  vatAmount: number | null;
  currency: string;
}

export interface CostBreakdown extends PurchaseCost {
  /** 预估合计 (订单快照 numberPrice + initialBalance), 用于对比 */
  estimatedTotal: string | null;
  source: "purchase_response";
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** 宽松取数字字段: 支持多种命名与字符串数字 */
function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && NUMERIC.test(raw.trim())) {
      return Number(raw.trim());
    }
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/** 从购买响应中解析实付成本; 无法识别返回 null */
export function parsePurchaseCost(raw: unknown): PurchaseCost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const total = pickNumber(source, ["total_price", "total", "amount", "paid", "amount_paid"]);
  const numberPrice = pickNumber(source, ["number_price", "price", "number_fee"]);
  const vatAmount = pickNumber(source, ["vat_amount", "vat", "tax", "tax_amount"]);
  const currency = pickString(source, ["currency"]) ?? "EUR";

  // 至少要知道实付总额才有统计意义
  if (total === null && numberPrice === null && vatAmount === null) return null;
  return { total, numberPrice, vatAmount, currency: currency.toUpperCase() };
}

/** 生成入库的成本构成 JSON (含预估合计, 便于后台对比) */
export function buildCostBreakdown(
  raw: unknown,
  estimated: { numberPrice: string; initialBalance: string } | null,
): CostBreakdown | null {
  const cost = parsePurchaseCost(raw);
  if (!cost) return null;
  return {
    ...cost,
    estimatedTotal: estimated
      ? (Number(estimated.numberPrice) + Number(estimated.initialBalance)).toFixed(2)
      : null,
    source: "purchase_response",
  };
}

/** 千分位友好的金额展示 (EUR) */
export function formatCost(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `€${n.toFixed(2)}`;
}
