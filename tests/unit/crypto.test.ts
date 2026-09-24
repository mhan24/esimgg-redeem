/**
 * 单元测试: 敏感信息加密 (规格 §6)
 */
import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, maskSecret, maskEmail } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("加解密往返一致", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    const secret = "esim_live_abcdef1234567890";
    const payload = encryptSecret(secret);
    expect(payload.startsWith("v1.")).toBe(true);
    expect(payload).not.toContain(secret);
    expect(decryptSecret(payload)).toBe(secret);
  });

  it("密文不包含明文", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    const payload = encryptSecret("super-secret-api-key");
    expect(payload).not.toContain("super-secret-api-key");
  });

  it("篡改密文会被检测 (GCM auth tag)", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    const payload = encryptSecret("hello");
    const parts = payload.split(".");
    // 翻转 ciphertext 第一个字符
    const ct = Buffer.from(parts[2], "base64url");
    ct[0] = ct[0] ^ 0xff;
    const tampered = [parts[0], parts[1], ct.toString("base64url"), parts[3]].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("错误主密钥无法解密", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    const payload = encryptSecret("hello");
    process.env.APP_ENCRYPTION_KEY =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(() => decryptSecret(payload)).toThrow();
    process.env.APP_ENCRYPTION_KEY = key;
  });

  it("格式无效时抛错", () => {
    expect(() => decryptSecret("garbage")).toThrow();
    expect(() => decryptSecret("v2.aaa.bbb.ccc")).toThrow();
  });

  it("掩码格式 (规格 §47)", () => {
    expect(maskSecret("esim_abcd1234")).toBe("esim_****1234");
    expect(maskSecret("short")).toBe("****");
    expect(maskEmail("user@example.com")).toBe("u***@example.com");
  });
});
