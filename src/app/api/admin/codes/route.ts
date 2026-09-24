/**
 * GET /api/admin/codes (规格 §49)
 */
import { listCodes } from "@/services/code-service";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import type { RedeemCodeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: RedeemCodeStatus[] = [
  "UNUSED",
  "LOCKED",
  "PURCHASED",
  "USED",
  "DISABLED",
];

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") ?? undefined;
    const status = STATUSES.includes(statusParam as RedeemCodeStatus)
      ? (statusParam as RedeemCodeStatus)
      : undefined;
    const result = await listCodes({
      status,
      search: url.searchParams.get("search") ?? undefined,
      batchId: url.searchParams.get("batchId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    });
    return jsonOk({
      ...result,
      items: result.items.map((c) => ({
        id: c.id,
        code: c.code,
        status: c.status,
        batchId: c.batchId,
        remark: c.remark,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        lockedAt: c.lockedAt?.toISOString() ?? null,
        usedAt: c.usedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
