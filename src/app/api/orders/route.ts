/**
 * POST /api/orders (规格 §23-§25)
 * 用户确认兑换: 锁卡密 -> 购买 -> 转移 (同步执行, 失败按状态机处理)
 * 转移接收方支持 esim.gg UserID 或邮箱，推荐 UserID
 */
import { latestActiveOrder } from "@/services/redeem-service";
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
import { isValidMsisdn, parseRecipient } from "@/lib/validate";
import { assertTrustedOrigin } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    const session = await getRedeemSession();
    if (!session) throw unauthorized("请先输入兑换码");

    const ip = clientIp(req);
    const limit = rateLimit(`order:${ip}`, 5, 60_000);
    if (!limit.ok) throw tooManyRequests(limit.retryAfterSec);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const { userid, email } = parseRecipient(body);
    const input = body as Record<string, unknown>;
    const msisdn = typeof input.msisdn === "string" ? input.msisdn.trim() : "";
    if (!isValidMsisdn(msisdn)) {
      throw new ApiError(400, "MSISDN_INVALID", "号码格式不正确");
    }

    try {
      const order = await startRedemption({
        codeId: session.codeId,
        msisdn,
        recipientAccountId: userid || undefined,
        recipientEmail: email || undefined,
      });
      logger.info("兑换流程完成", { msisdn, status: order.status });
      return jsonOk({ order: serializeOrder(order) });
    } catch (err) {
      // A purchase may already have succeeded. Return its status link on errors
      // and repeated submissions instead of leaving the customer on checkout.
      const response = jsonError(err);
      const order = await latestActiveOrder(session.codeId).catch(() => null);
      if (!order) return response;
      return Response.json({ ...await response.json(), order: serializeOrder(order) }, { status: response.status });
    }
  } catch (err) {
    return jsonError(err);
  }
}
