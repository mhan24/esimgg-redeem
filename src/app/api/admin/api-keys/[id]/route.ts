/**
 * PATCH/DELETE /api/admin/api-keys/:id (规格 §71)
 * 改名 / 启用禁用 / 上移下移 / 删除; 全部写审计
 */
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import {
  deleteApiKey,
  moveApiKey,
  renameApiKey,
  setApiKeyEnabled,
} from "@/services/api-key-service";
import { writeAudit } from "@/services/audit-service";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const changes: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name : "";
      await renameApiKey(id, name);
      changes.name = name.trim();
    }
    if (body.enabled !== undefined) {
      const enabled = Boolean(body.enabled);
      await setApiKeyEnabled(id, enabled);
      changes.enabled = enabled;
    }
    if (body.direction !== undefined) {
      const direction = body.direction === "up" ? "up" : "down";
      await moveApiKey(id, direction);
      changes.direction = direction;
    }

    if (Object.keys(changes).length === 0) {
      throw new ApiError(400, "NOTHING_TO_UPDATE", "没有需要修改的字段");
    }

    await writeAudit({
      adminId: admin.adminId,
      action: "API_KEY_UPDATE",
      targetType: "esim_api_key",
      targetId: id,
      metadata: changes,
      ip: clientIp(req),
    });
    logger.info("API Key 已更新", { keyId: id, changes });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;

    const { detachedOrders } = await deleteApiKey(id);
    await writeAudit({
      adminId: admin.adminId,
      action: "API_KEY_DELETE",
      targetType: "esim_api_key",
      targetId: id,
      metadata: { detachedOrders },
      ip: clientIp(req),
    });
    return jsonOk({ ok: true, detachedOrders });
  } catch (err) {
    return jsonError(err);
  }
}
