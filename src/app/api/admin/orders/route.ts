/**
 * GET /api/admin/orders (规格 §39/§49)
 */
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PURCHASING",
  "PURCHASE_UNCERTAIN",
  "PURCHASED",
  "TRANSFERRING",
  "TRANSFER_FAILED",
  "COMPLETED",
  "FAILED",
];

function serialize(o: {
  id: string;
  msisdn: string;
  numberPrice: Prisma.Decimal;
  initialBalance: Prisma.Decimal;
  recipientEmail: string | null;
  recipientAccountId: string | null;
  status: OrderStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  purchasedAt: Date | null;
  completedAt: Date | null;
  redeemCode: { code: string };
  retryCount: number;
}) {
  return {
    id: o.id,
    code: o.redeemCode.code,
    msisdn: o.msisdn,
    numberPrice: o.numberPrice.toString(),
    initialBalance: o.initialBalance.toString(),
    recipientEmail: o.recipientEmail,
    recipientAccountId: o.recipientAccountId,
    status: o.status,
    errorCode: o.errorCode,
    errorMessage: o.errorMessage,
    retryCount: o.retryCount,
    createdAt: o.createdAt.toISOString(),
    purchasedAt: o.purchasedAt?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") ?? undefined;
    const status = STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (statusParam === "EXCEPTIONS") {
      // 异常订单: 购买待核实 + 转移失败 (规格 §40)
      where.status = { in: ["PURCHASE_UNCERTAIN", "TRANSFER_FAILED"] };
    }
    if (search) {
      where.OR = [
        { msisdn: { contains: search } },
        { recipientEmail: { contains: search } },
        { redeemCode: { code: { contains: search } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { redeemCode: { select: { code: true } } },
      }),
    ]);
    return jsonOk({ total, page, pageSize, items: items.map(serialize) });
  } catch (err) {
    return jsonError(err);
  }
}
