/**
 * GET /api/admin/audit (规格 §38)
 */
import { listAudit } from "@/services/audit-service";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const result = await listAudit({
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 20),
      action: url.searchParams.get("action") ?? undefined,
    });
    return jsonOk({
      ...result,
      items: result.items.map((a) => ({
        id: a.id,
        adminId: a.adminId,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
