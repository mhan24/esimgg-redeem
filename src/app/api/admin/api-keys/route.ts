/**
 * GET/POST /api/admin/api-keys (规格 §71)
 * 多 API Key 管理: 列表 (掩码) / 新增
 */
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import {
  createApiKey,
  listApiKeyViews,
} from "@/services/api-key-service";
import { writeAudit } from "@/services/audit-service";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";
import { getSettings } from "@/services/settings-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [keys, settings] = await Promise.all([
      listApiKeyViews(),
      getSettings(),
    ]);
    return jsonOk({
      keys,
      keyStrategy: settings.keyStrategy,
      keyLowBalanceThreshold: settings.keyLowBalanceThreshold.toString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);

    let body: { name?: unknown; apiKey?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const name = typeof body.name === "string" ? body.name : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    const created = await createApiKey({ name, apiKey });

    await writeAudit({
      adminId: admin.adminId,
      action: "API_KEY_CREATE",
      targetType: "esim_api_key",
      targetId: created.id,
      metadata: { name: created.name },
      ip: clientIp(req),
    });
    logger.info("API Key 已添加", { keyId: created.id, name: created.name });
    return jsonOk({ ok: true, id: created.id });
  } catch (err) {
    return jsonError(err);
  }
}
