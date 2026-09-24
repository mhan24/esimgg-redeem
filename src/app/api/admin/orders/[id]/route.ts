/**
 * GET /api/admin/orders/:id — 订单详情 (含内部响应, 仅后台可见)
 */
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, notFound } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        redeemCode: { select: { code: true, status: true } },
        apiKey: { select: { name: true } },
      },
    });
    if (!order) throw notFound("订单不存在");
    return jsonOk({
      id: order.id,
      code: order.redeemCode.code,
      codeStatus: order.redeemCode.status,
      msisdn: order.msisdn,
      numberPrice: order.numberPrice.toString(),
      initialBalance: order.initialBalance.toString(),
      recipientEmail: order.recipientEmail,
      recipientAccountId: order.recipientAccountId,
      status: order.status,
      errorCode: order.errorCode,
      errorMessage: order.errorMessage,
      retryCount: order.retryCount,
      /** 官方实付成本 (规格 §71) */
      apiKeyName: order.apiKey?.name ?? null,
      costTotal: order.costTotal?.toString() ?? null,
      costBreakdown: order.costBreakdown,
      purchaseResponse: order.purchaseResponse,
      transferResponse: order.transferResponse,
      createdAt: order.createdAt.toISOString(),
      purchasedAt: order.purchasedAt?.toISOString() ?? null,
      completedAt: order.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
