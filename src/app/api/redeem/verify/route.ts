/**
 * POST /api/redeem/verify (规格 §20/§69)
 * 防暴力破解: 单 IP 10 次失败 / 10 分钟 (规格 §43) + Turnstile 人机验证 (规格 §69)
 */
import { verifyCode } from "@/services/redeem-service";
import { createRedeemSession } from "@/lib/redeem-session";
import { extractTurnstileToken, verifyTurnstile } from "@/lib/turnstile";
import {
  ApiError,
  badRequest,
  clientIp,
  jsonError,
  jsonOk,
  tooManyRequests,
} from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const limit = rateLimit(`verify:${ip}`, MAX_FAILURES, WINDOW_MS);
    if (!limit.ok) {
      throw tooManyRequests(limit.retryAfterSec);
    }

    let body: { code?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    // 人机验证 (未配置密钥时自动跳过)
    const turnstile = await verifyTurnstile(extractTurnstileToken(body), ip);
    if (!turnstile.ok) {
      throw badRequest("TURNSTILE_FAILED", "人机验证未通过，请重试");
    }

    const result = await verifyCode(typeof body.code === "string" ? body.code : "");
    // 绑定兑换会话 (后续搜索/下单据此识别卡密)
    await createRedeemSession({
      codeId: result.codeId,
      code: result.code,
    });
    logger.info("卡密验证成功", { code: result.code.slice(0, 9) + "****", kind: result.kind });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
