/**
 * 单元测试: 用户错误提示映射 (规格 §51)
 */
import { describe, expect, it } from "vitest";
import {
  purchaseErrorMessage,
  transferErrorMessage,
} from "@/services/error-messages";
import { EsimApiError } from "@/lib/esim/errors";

describe("error messages (规格 §51)", () => {
  it("号码被抢 -> 提示重新选号", () => {
    const err = EsimApiError.definitive("409 number unavailable", 409, "NUMBER_UNAVAILABLE");
    const msg = purchaseErrorMessage(err);
    expect(msg.code).toBe("NUMBER_UNAVAILABLE");
    expect(msg.message).toContain("该号码已不可用");
  });

  it("余额不足 -> 提示联系管理员", () => {
    const err = EsimApiError.definitive("insufficient wallet balance", 400, "INSUFFICIENT_FUNDS");
    expect(purchaseErrorMessage(err).message).toContain("系统余额不足");
  });

  it("429 -> 请求过于频繁", () => {
    const err = EsimApiError.uncertain("too many requests", 429, "RATE_LIMITED");
    expect(purchaseErrorMessage(err).code).toBe("RATE_LIMITED");
    expect(transferErrorMessage(err).message).toContain("请求过于频繁");
  });

  it("转移: 邮箱/账户问题 -> 详细指引且不重复购买", () => {
    const err = EsimApiError.definitive("recipient account not found", 404, "ACCOUNT_NOT_FOUND");
    const msg = transferErrorMessage(err);
    expect(msg.code).toBe("TRANSFER_RECIPIENT_INVALID");
    expect(msg.message).toContain("不会重复购买号码");
  });

  it("转移: uncertain -> 提示稍后重试", () => {
    const err = EsimApiError.uncertain("timeout");
    expect(transferErrorMessage(err).code).toBe("TRANSFER_UNCERTAIN");
    expect(transferErrorMessage(err).message).toContain("不会重复购买号码");
  });

  it("购买: uncertain -> 提示核实中", () => {
    const err = EsimApiError.uncertain("timeout");
    expect(purchaseErrorMessage(err).message).toContain("核实");
  });
});
