/**
 * 敏感信息加密 (规格 §6: AES-256-GCM, 主密钥 APP_ENCRYPTION_KEY)
 * 仅用于服务端加密存储 esim.gg API Key, 绝不明文落库或返回前端
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY 未配置");
  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY 必须是 32 字节 (64 位 hex 或 base64)");
  }
  return key;
}

/** 加密为 `v1.<iv>.<ciphertext>.<tag>` (base64url) */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ct.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

/** 解密 `v1.<iv>.<ciphertext>.<tag>`; 失败抛错 (含被篡改检测) */
export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("加密数据格式无效");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** 脱敏: `esim_****abcd` (规格 §47) */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 5)}****${value.slice(-4)}`;
}

/** 邮箱脱敏 (规格 §47): `a***@example.com` */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const head = name.slice(0, 1);
  return `${head}***${domain}`;
}
