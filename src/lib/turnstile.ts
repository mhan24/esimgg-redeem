/**
 * Cloudflare Turnstile 服务端校验 (人机验证, 规格 §69)
 * 文档: https://developers.cloudflare.com/turnstile/api/verify/
 *
 * 策略:
 * - 未配置 TURNSTILE_SECRET_KEY -> 跳过校验 (本地开发/测试不受影响)
 * - 缺少 token -> 拒绝
 * - siteverify 返回 success:false -> 拒绝
 * - 网络错误/超时/非 2xx -> 失败关闭 (拒绝), 避免校验服务不可用时被绕过
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;

export interface TurnstileResult {
  /** 是否通过 */
  ok: boolean;
  /** 未配置密钥, 本次跳过了校验 */
  skipped?: boolean;
  /** Cloudflare 返回的错误码 (或本地产生的错误标识) */
  errorCodes?: string[];
}

/** 是否启用了 Turnstile (配置了密钥) */
export function isTurnstileEnabled(): boolean {
  return env.TURNSTILE_SECRET_KEY.length > 0;
}

/** 从请求体中取出 token (宽松: 允许字符串或 undefined) */
export function extractTurnstileToken(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const token = (body as { turnstileToken?: unknown }).turnstileToken;
  return typeof token === "string" ? token : undefined;
}

/**
 * 校验一次性 token。
 * @param token 前端 widget 产出的 cf-turnstile-response
 * @param remoteIp 客户端 IP (可选, 传给 Cloudflare 提高准确度)
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!isTurnstileEnabled()) {
    return { ok: true, skipped: true };
  }
  if (!token || token.trim().length === 0) {
    return { ok: false, errorCodes: ["missing-input-response"] };
  }

  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token.trim(),
  });
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      logger.error("Turnstile siteverify 请求失败", { status: res.status });
      return { ok: false, errorCodes: ["verify-http-error"] };
    }
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success !== true) {
      logger.warn("Turnstile 校验未通过", { errorCodes: data["error-codes"] ?? [] });
    }
    return { ok: data.success === true, errorCodes: data["error-codes"] ?? [] };
  } catch (err) {
    logger.error("Turnstile siteverify 网络错误", { err: String(err) });
    return { ok: false, errorCodes: ["verify-network-error"] };
  }
}
