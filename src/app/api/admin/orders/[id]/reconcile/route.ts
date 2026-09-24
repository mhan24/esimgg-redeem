/**
 * POST /api/admin/orders/:id/reconcile (规格 §27/§40)
 * PURCHASE_UNCERTAIN 人工对账: 确认号码已在平台账户后继续转移
 */
import { reconcilePurchase } from "@/services/purchase-service";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
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

    const order = await reconcilePurchase(id, admin.adminId);

    await writeAudit({
      adminId: admin.adminId,
      action: "ORDER_RECONCILE",
      targetType: "order",
      targetId: id,
      metadata: { status: order.status },
      ip: clientIp(req),
    });
    logger.info("管理员对账订单", { orderId: id, status: order.status });
    return jsonOk({ id: order.id, status: order.status });
  } catch (err) {
    return jsonError(err);
  }
}
