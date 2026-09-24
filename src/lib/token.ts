/**
 * 签名令牌工具 (规格 §44 会话 / §12 redeem session)
 * HMAC-SHA256 签名 + base64url 编码, 不依赖外部 JWT 库
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireSessionSecret } from "./env";

export interface TokenPayload {
  [key: string]: unknown;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

function sign(data: string): string {
  return createHmac("sha256", requireSessionSecret())
    .update(data)
    .digest("base64url");
}

/** 生成 `payload.signature` 令牌, ttlSec 秒后过期 */
export function createToken<T extends object>(
  payload: T,
  ttlSec: number,
): { token: string; expiresAt: Date } {
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = b64urlEncode(Buffer.from(JSON.stringify(body), "utf8"));
  return {
    token: `${data}.${sign(data)}`,
    expiresAt: new Date(Date.now() + ttlSec * 1000),
  };
}

/** 验签并解析; 无效/过期返回 null */
export function verifyToken(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(b64urlDecode(data).toString("utf8"));
  } catch {
    return null;
  }
  const exp = typeof body.exp === "number" ? body.exp : 0;
  if (exp * 1000 < Date.now()) return null;
  return body;
}

/** 生成 URL 安全的随机 ID (卡密/令牌用) */
export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
