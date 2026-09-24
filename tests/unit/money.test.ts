/**
 * 单元测试: 金额助手 (整数分, 避免浮点误差)
 */
import { describe, expect, it } from "vitest";
import { toCents, fromCents, parseEurInput, rechargeAmountString } from "@/lib/money";

describe("money", () => {
  it("十进制转分", () => {
    expect(toCents("0.05")).toBe(5);
    expect(toCents("2.00")).toBe(200);
    expect(toCents(0.5)).toBe(50);
    expect(toCents("123.45")).toBe(12345);
  });

  it("分转字符串", () => {
    expect(fromCents(5)).toBe("0.05");
    expect(fromCents(200)).toBe("2.00");
    expect(fromCents(0)).toBe("0.00");
  });

  it("parseEurInput 校验", () => {
    expect(parseEurInput("0.05")).toBe(5);
    expect(parseEurInput("2")).toBe(200);
    expect(parseEurInput("2.5")).toBe(250);
    expect(parseEurInput("2.555")).toBeNull(); // 超过两位小数
    expect(parseEurInput("abc")).toBeNull();
    expect(parseEurInput("-1")).toBeNull();
    expect(parseEurInput("")).toBeNull();
    expect(parseEurInput(null)).toBeNull();
    expect(parseEurInput("1,5")).toBeNull();
  });

  it("recharge_amount 字符串格式 (规格 §24)", () => {
    expect(rechargeAmountString(5)).toBe("0.05");
    expect(rechargeAmountString(100)).toBe("1.00");
  });

  it("0.1 + 0.2 类浮点问题不会出现", () => {
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
  });
});
