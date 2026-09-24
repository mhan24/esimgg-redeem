/**
 * 单元测试: 签名令牌 (规格 §44)
 */
import { describe, expect, it } from "vitest";
import { createToken, verifyToken, randomId } from "@/lib/token";

describe("token (HMAC-SHA256)", () => {
  it("创建并验签通过", () => {
    const { token } = createToken({ adminId: "abc", username: "admin" }, 60);
    const payload = verifyToken(token);
    expect(payload?.adminId).toBe("abc");
    expect(payload?.username).toBe("admin");
  });

  it("过期令牌被拒绝", () => {
    const { token } = createToken({ adminId: "abc" }, -1);
    expect(verifyToken(token)).toBeNull();
  });

  it("篡改 payload 被拒绝", () => {
    const { token } = createToken({ adminId: "abc" }, 60);
    const dot = token.lastIndexOf(".");
    const data = token.slice(0, dot);
    const forged = Buffer.from(
      JSON.stringify({ adminId: "evil", exp: Math.floor(Date.now() / 1000) + 60 }),
      "utf8",
    ).toString("base64url");
    expect(verifyToken(`${forged}.${token.slice(dot + 1)}`)).toBeNull();
    expect(verifyToken(`${data}x.${token.slice(dot + 1)}`)).toBeNull();
  });

  it("签名错误被拒绝", () => {
    const { token } = createToken({ adminId: "abc" }, 60);
    const dot = token.lastIndexOf(".");
    const badSig = "A".repeat(43);
    expect(verifyToken(`${token.slice(0, dot)}.${badSig}`)).toBeNull();
  });

  it("空/畸形令牌返回 null", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("noseparator")).toBeNull();
    expect(verifyToken("a.b")).toBeNull();
  });

  it("randomId 生成足够熵的随机值", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => randomId()));
    expect(ids.size).toBe(1000);
  });
});
