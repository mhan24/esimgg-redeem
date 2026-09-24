/**
 * 单元测试: 官方实付成本解析 (规格 §71)
 */
import { describe, expect, it } from "vitest";
import {
  buildCostBreakdown,
  formatCost,
  parsePurchaseCost,
} from "@/lib/esim/cost";

describe("parsePurchaseCost (规格 §71)", () => {
  it("解析 /checkout/new_line 真实响应", () => {
    const cost = parsePurchaseCost({
      success: true,
      vat_amount: 0,
      total_price: 2.99,
      number_price: 0,
      redirect_url: "https://esim.gg/lines?success=true",
    });
    expect(cost).toEqual({
      total: 2.99,
      numberPrice: 0,
      vatAmount: 0,
      currency: "EUR",
    });
  });

  it("兼容字符串数字与其它命名", () => {
    const cost = parsePurchaseCost({
      total: "12.50",
      price: "10.00",
      vat: "2.50",
      currency: "eur",
    });
    expect(cost).toEqual({
      total: 12.5,
      numberPrice: 10,
      vatAmount: 2.5,
      currency: "EUR",
    });
  });

  it("缺省字段返回 null 而非 0", () => {
    const cost = parsePurchaseCost({ success: true, redirect_url: "x" });
    expect(cost).toBeNull();
  });

  it("仅有部分字段也可解析", () => {
    expect(parsePurchaseCost({ total_price: 1.23 })).toEqual({
      total: 1.23,
      numberPrice: null,
      vatAmount: null,
      currency: "EUR",
    });
  });

  it("非对象/数组/空值返回 null", () => {
    expect(parsePurchaseCost(null)).toBeNull();
    expect(parsePurchaseCost(undefined)).toBeNull();
    expect(parsePurchaseCost("2.99")).toBeNull();
    expect(parsePurchaseCost([1, 2])).toBeNull();
    expect(parsePurchaseCost(42)).toBeNull();
  });

  it("非数值字符串被忽略", () => {
    expect(parsePurchaseCost({ total_price: "N/A" })).toBeNull();
    expect(parsePurchaseCost({ total_price: {} })).toBeNull();
  });
});

describe("buildCostBreakdown (规格 §71)", () => {
  it("附带预估合计 (订单快照 numberPrice + initialBalance)", () => {
    const breakdown = buildCostBreakdown(
      { total_price: 2.99, number_price: 0, vat_amount: 0 },
      { numberPrice: "0.00", initialBalance: "0.50" },
    );
    expect(breakdown).toEqual({
      total: 2.99,
      numberPrice: 0,
      vatAmount: 0,
      currency: "EUR",
      estimatedTotal: "0.50",
      source: "purchase_response",
    });
  });

  it("无订单快照时 estimatedTotal 为 null", () => {
    const breakdown = buildCostBreakdown({ total_price: 1 }, null);
    expect(breakdown?.estimatedTotal).toBeNull();
  });

  it("无法识别成本时返回 null", () => {
    expect(buildCostBreakdown({ success: true }, null)).toBeNull();
  });
});

describe("formatCost", () => {
  it("数字与字符串统一格式化为两位小数", () => {
    expect(formatCost(2.99)).toBe("€2.99");
    expect(formatCost("2.9")).toBe("€2.90");
    expect(formatCost(0)).toBe("€0.00");
  });
  it("空值显示占位符", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
    expect(formatCost("abc")).toBe("—");
  });
});
