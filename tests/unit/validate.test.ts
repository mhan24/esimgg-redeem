/**
 * 单元测试: UserID 校验 (接收方为 esim.gg UserID, cm 开头)
 */
import { describe, expect, it } from "vitest";
import {
  isValidUserid,
  isValidEmail,
  isValidMsisdn,
  normalizeUserid,
} from "@/lib/validate";

describe("validate: UserID", () => {
  it("normalizeUserid: 去空白", () => {
    expect(normalizeUserid("  cmabc123 ")).toBe("cmabc123");
    expect(normalizeUserid("cm abc")).toBe("cmabc");
    expect(normalizeUserid(undefined)).toBe("");
    expect(normalizeUserid(123)).toBe("");
  });

  it("合法 UserID 通过", () => {
    expect(isValidUserid("cmabc123456")).toBe(true);
    expect(isValidUserid("cmXy9-abc_123")).toBe(true);
    expect(isValidUserid("CM1234")).toBe(true);
  });

  it("邮箱/过短/非法字符被拒绝", () => {
    expect(isValidUserid("user@example.com")).toBe(false);
    expect(isValidUserid("cm1")).toBe(false); // 过短
    expect(isValidUserid("cmabc 123")).toBe(false); // 空格
    expect(isValidUserid("")).toBe(false);
  });

  it("邮箱与号码校验仍可用 (后台备用)", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidMsisdn("37212345678")).toBe(true);
    expect(isValidMsisdn("372")).toBe(false);
  });
});
