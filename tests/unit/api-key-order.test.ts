/**
 * 单元测试: API Key 策略排序与错误分类 (规格 §71)
 */
import { describe, expect, it } from "vitest";
import { orderKeysByStrategy } from "@/services/api-key-service";
import {
  isInsufficientBalanceError,
  isKeyLevelError,
} from "@/services/esim-gateway";
import { EsimApiError } from "@/lib/esim/errors";

const keys = [
  { id: "k1", sortOrder: 0 },
  { id: "k2", sortOrder: 1 },
  { id: "k3", sortOrder: 2 },
];

describe("orderKeysByStrategy (规格 §71)", () => {
  it("sequential: 保持 sortOrder 顺序 (从第一个到最后一个)", () => {
    const ordered = orderKeysByStrategy(keys, "sequential");
    expect(ordered.map((k) => k.id)).toEqual(["k1", "k2", "k3"]);
  });

  it("random: 覆盖全部 Key 且不丢不重", () => {
    for (let i = 0; i < 20; i++) {
      const ordered = orderKeysByStrategy(keys, "random");
      expect(ordered).toHaveLength(3);
      expect([...ordered].map((k) => k.id).sort()).toEqual(["k1", "k2", "k3"]);
    }
  });

  it("random: 不会修改传入数组", () => {
    const input = [...keys];
    orderKeysByStrategy(input, "random");
    expect(input.map((k) => k.id)).toEqual(["k1", "k2", "k3"]);
  });

  it("空列表与单 Key 安全", () => {
    expect(orderKeysByStrategy([], "random")).toEqual([]);
    expect(orderKeysByStrategy([keys[0]], "random")).toEqual([keys[0]]);
  });
});

describe("isInsufficientBalanceError (规格 §71)", () => {
  it("402 状态码", () => {
    expect(
      isInsufficientBalanceError(EsimApiError.definitive("payment required", 402)),
    ).toBe(true);
  });
  it("错误码/消息含余额关键词", () => {
    for (const msg of [
      "INSUFFICIENT_BALANCE",
      "insufficient funds",
      "wallet balance too low",
      "余额不足",
    ]) {
      expect(isInsufficientBalanceError(EsimApiError.definitive(msg))).toBe(true);
    }
  });
  it("与余额无关的明确失败不切换", () => {
    expect(
      isInsufficientBalanceError(
        EsimApiError.definitive("NUMBER_UNAVAILABLE", 409, "NUMBER_UNAVAILABLE"),
      ),
    ).toBe(false);
  });
  it("结果未知的错误不算余额不足 (绝不因此切换)", () => {
    expect(
      isInsufficientBalanceError(EsimApiError.uncertain("timeout", undefined, "TIMEOUT")),
    ).toBe(false);
  });
});

describe("isKeyLevelError (规格 §71)", () => {
  it("401/403 与 Key 相关错误", () => {
    expect(isKeyLevelError(EsimApiError.definitive("unauthorized", 401))).toBe(true);
    expect(isKeyLevelError(EsimApiError.definitive("forbidden", 403))).toBe(true);
    expect(isKeyLevelError(EsimApiError.definitive("INVALID_API_KEY"))).toBe(true);
    expect(isKeyLevelError(EsimApiError.definitive("token expired"))).toBe(true);
  });
  it("业务失败不属于 Key 级", () => {
    expect(
      isKeyLevelError(EsimApiError.definitive("NUMBER_UNAVAILABLE", 409)),
    ).toBe(false);
    expect(isKeyLevelError(EsimApiError.definitive("recipient not found", 404))).toBe(
      false,
    );
  });
});
