/**
 * GET /api/orders/:token (规格 §48)
 * 用户凭 accessToken 查询订单状态 (轮询用)
 */
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, notFound } from "@/lib/http";
import { serializeOrder } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const order = await prisma.order.findUnique({
      where: { accessToken: token },
    });
    if (!order) throw notFound("订单不存在");
    return jsonOk({ order: serializeOrder(order) });
  } catch (err) {
    return jsonError(err);
  }
}
