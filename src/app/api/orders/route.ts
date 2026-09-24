/**
 * POST /api/orders (规格 §23-§25)
 * 用户确认兑换: 锁卡密 -> 购买 -> 转移 (同步执行, 失败按状态机处理)
 * 转移接收方使用 esim.gg UserID (cm 开头), 映射 recipient_account_id
 */
import { startRedemption } from "@/services/purchase-service";
import { getRedeemSession } from "@/lib/redeem-session";
import {
  ApiError,
  clientIp,
  jsonError,
  jsonOk,
  tooManyRequests,
  unauthorized,
} from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { serializeOrder } from "@/lib/serialize";
import {
  isValidMsisdn,
  isValidUserid,
  normalizeUserid,
} from "@/lib/validate";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getRedeemSession();
    if (!session) throw unauthorized("请先输入兑换码");

    const ip = clientIp(req);
    const limit = rateLimit(`order:${ip}`, 5, 60_000);
    if (!limit.ok) throw tooManyRequests(limit.retryAfterSec);

    let body: {
      msisdn?: unknown;
      userid?: unknown;
      accountId?: unknown;
      email?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const msisdn = typeof body.msisdn === "string" ? body.msisdn.trim() : "";
    if (!isValidMsisdn(msisdn)) {
      throw new ApiError(400, "MSISDN_INVALID", "号码格式不正确");
    }

    // 接收方: UserID (cm 开头) 优先; accountId 为兼容别名; email 仅后台手动重试使用
    const userid =
      normalizeUserid(body.userid) || normalizeUserid(body.accountId);
    if (userid) {
      if (userid.includes("@")) {
        throw new ApiError(
          400,
          "USERID_INVALID",
          "请输入 UserID（cm 开头），不要填写邮箱",
        );
      }
      if (!isValidUserid(userid)) {
        throw new ApiError(400, "USERID_INVALID", "UserID 格式不正确");
      }
    }
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "EMAIL_INVALID", "邮箱格式不正确");
    }
    if (!userid && !email) {
      throw new ApiError(400, "RECIPIENT_REQUIRED", "请填写接收 UserID");
    }

    const order = await startRedemption({
      codeId: session.codeId,
      msisdn,
      recipientAccountId: userid || undefined,
      recipientEmail: email || undefined,
    });

    logger.info("兑换流程完成", { msisdn, status: order.status });
    return jsonOk({ order: serializeOrder(order) });
  } catch (err) {
    return jsonError(err);
  }
}
