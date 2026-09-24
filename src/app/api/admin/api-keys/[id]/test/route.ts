/**
 * POST /api/admin/api-keys/:id/test (规格 §71)
 * 测试指定 Key 的连接并刷新其余额缓存
 */
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { refreshKeyBalance } from "@/services/api-key-service";
import { writeAudit } from "@/services/audit-service";
import { EsimApiError } from "@/lib/esim/errors";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;

    const wallet = await refreshKeyBalance(id);
    await writeAudit({
      adminId: admin.adminId,
      action: "ESIM_API_TEST",
      targetType: "esim_api_key",
      targetId: id,
      metadata: { ok: true },
      ip: clientIp(req),
    });
    return jsonOk({ ok: true, wallet });
  } catch (err) {
    if (err instanceof EsimApiError) {
      return jsonOk({
        ok: false,
        error: err.errorCode ?? "ESIM_API_ERROR",
        message: err.message,
      });
    }
    if (err instanceof ApiError) {
      return jsonOk({ ok: false, error: err.code, message: err.message });
    }
    return jsonError(err);
  }
}
