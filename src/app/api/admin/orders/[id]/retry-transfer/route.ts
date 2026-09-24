/**
 * POST /api/admin/orders/:id/retry-transfer (规格 §31/§40)
 * 仅允许重新转移, 禁止重新购买 (原则 3)
 */
import { transferOrder } from "@/services/transfer-service";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;

    let body: { userid?: unknown; accountId?: unknown; email?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }
    const userid =
      typeof body.userid === "string"
        ? body.userid.trim()
        : typeof body.accountId === "string"
          ? body.accountId.trim()
          : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    const order = await transferOrder(id, {
      recipientAccountId: userid || undefined,
      recipientEmail: email || undefined,
    });

    await writeAudit({
      adminId: admin.adminId,
      action: "ORDER_RETRY_TRANSFER",
      targetType: "order",
      targetId: id,
      metadata: { userid: userid || null, email: email || null },
      ip: clientIp(req),
    });
    logger.info("管理员重试转移", { orderId: id, status: order.status });
    return jsonOk({ id: order.id, status: order.status });
  } catch (err) {
    return jsonError(err);
  }
}
