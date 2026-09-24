/**
 * 单元测试: 免费/付费模式过滤 (规格 §8-§10, 原则 6/7)
 */
import { describe, expect, it } from "vitest";
import { filterByMode } from "@/services/search-service";

const numbers = [
  { msisdn: "37200000001", price: 0 },
  { msisdn: "37200000002", price: 0.5 },
  { msisdn: "37200000003", price: 1.5 },
  { msisdn: "37200000004", price: 2 },
  { msisdn: "37200000005", price: 2.01 },
  { msisdn: "37200000006", price: 5 },
];

describe("filterByMode (规格 §10)", () => {
  it("模式 A: 免费 ON 付费 OFF -> 仅 price=0", () => {
    const result = filterByMode(numbers, {
      allowFreeNumbers: true,
      allowPaidNumbers: false,
      maxPaidNumberPrice: "2.00",
    });
    expect(result.map((n) => n.msisdn)).toEqual(["37200000001"]);
    expect(result.every((n) => Number(n.price) === 0)).toBe(true);
  });

  it("模式 B: 免费 ON 付费 ON -> 免费 + price<=max", () => {
    const result = filterByMode(numbers, {
      allowFreeNumbers: true,
      allowPaidNumbers: true,
      maxPaidNumberPrice: "2.00",
    });
    expect(result.map((n) => n.msisdn)).toEqual([
      "37200000001",
      "37200000002",
      "37200000003",
      "37200000004",
    ]);
  });

  it("模式 C: 免费 OFF 付费 ON -> 0 < price <= max", () => {
    const result = filterByMode(numbers, {
      allowFreeNumbers: false,
      allowPaidNumbers: true,
      maxPaidNumberPrice: "2.00",
    });
    expect(result.map((n) => n.msisdn)).toEqual([
      "37200000002",
      "37200000003",
      "37200000004",
    ]);
  });

  it("模式 D: 均 OFF -> 空 (前台提示暂未开放)", () => {
    const result = filterByMode(numbers, {
      allowFreeNumbers: false,
      allowPaidNumbers: false,
      maxPaidNumberPrice: "2.00",
    });
    expect(result).toEqual([]);
  });

  it("API 异常返回付费号码时服务端仍过滤 (规格 §8)", () => {
    // 模拟 API 在 zero_price_only=true 时仍返回付费号码
    const leaky = [
      { msisdn: "37200000001", price: 0 },
      { msisdn: "37200000009", price: 99 },
    ];
    const result = filterByMode(leaky, {
      allowFreeNumbers: true,
      allowPaidNumbers: false,
      maxPaidNumberPrice: "2.00",
    });
    expect(result.map((n) => n.msisdn)).toEqual(["37200000001"]);
  });

  it("边界: 2.00 显示, 2.01 不显示 (规格 §9)", () => {
    const result = filterByMode(numbers, {
      allowFreeNumbers: true,
      allowPaidNumbers: true,
      maxPaidNumberPrice: "2.00",
    });
    expect(result.some((n) => n.price === 2)).toBe(true);
    expect(result.some((n) => n.price === 2.01)).toBe(false);
  });
});
