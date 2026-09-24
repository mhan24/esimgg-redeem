/**
 * POST /api/orders/:token/retry-transfer (规格 §31/§48)
 * 用户修改接收 UserID 后重新转移; 绝不重新购买 (原则 3)
 */
import { prisma } from "@/lib/prisma";
import { transferOrder } from "@/services/transfer-service";
import { getRedeemSession } from "@/lib/redeem-session";
import {
  ApiError,
  clientIp,
  jsonError,
  jsonOk,
  notFound,
  tooManyRequests,
  unauthorized,
} from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { serializeOrder } from "@/lib/serialize";
import { isValidUserid, normalizeUserid } from "@/lib/validate";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const session = await getRedeemSession();
    const order = await prisma.order.findUnique({
      where: { accessToken: token },
    });
    if (!order) throw notFound("订单不存在");
    // 仅允许持有该卡密兑换会话的用户操作
    if (!session || session.codeId !== order.redeemCodeId) {
      throw unauthorized("请先输入对应兑换码");
    }

    const ip = clientIp(req);
    const limit = rateLimit(`retry-transfer:${ip}`, 5, 60_000);
    if (!limit.ok) throw tooManyRequests(limit.retryAfterSec);

    let body: { userid?: unknown; accountId?: unknown; email?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    // 接收方: UserID 优先 (accountId 兼容), 邮箱仅后台使用
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

    const updated = await transferOrder(order.id, {
      recipientAccountId: userid || undefined,
      recipientEmail: email || undefined,
    });
    logger.info("用户重试转移", { status: updated.status });
    return jsonOk({ order: serializeOrder(updated) });
  } catch (err) {
    return jsonError(err);
  }
}
