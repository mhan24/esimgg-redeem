/**
 * POST /api/admin/esim/test (规格 §6/§71)
 * 测试连接: 传入 Key 优先, 否则按 Key ID 测试, 再否则按策略选一个;
 * 统一调用 /wallet/balance 并刷新该 Key 的余额缓存
 */
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { refreshKeyBalance } from "@/services/api-key-service";
import { callWithKeys } from "@/services/esim-gateway";
import { EsimClient } from "@/lib/esim/client";
import { EsimApiError } from "@/lib/esim/errors";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);

    let body: { apiKey?: unknown; keyId?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const providedKey =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const keyId = typeof body.keyId === "string" ? body.keyId : "";

    // 1. 传入的 Key 优先 (新增前验证)
    if (providedKey) {
      const client = new EsimClient(providedKey);
      const wallet = await client.getWalletBalance("eur");
      return jsonOk({
        ok: true,
        wallet: { currency: wallet.currency, balance: wallet.balance },
      });
    }

    // 2. 指定 Key ID
    if (keyId) {
      const wallet = await refreshKeyBalance(keyId);
      await writeAudit({
        adminId: admin.adminId,
        action: "ESIM_API_TEST",
        targetType: "esim_api_key",
        targetId: keyId,
        metadata: { ok: true },
        ip: clientIp(req),
      });
      return jsonOk({ ok: true, wallet });
    }

    // 3. 按策略选择一个 Key 测试
    const call = await callWithKeys({
      task: (client) => client.getWalletBalance("eur"),
    });
    if (!call.key.legacy) {
      await refreshKeyBalance(call.key.id);
    }
    await writeAudit({
      adminId: admin.adminId,
      action: "ESIM_API_TEST",
      targetType: "esim_api_key",
      targetId: call.key.id,
      metadata: { ok: true, legacy: call.key.legacy },
      ip: clientIp(req),
    });
    return jsonOk({ ok: true, wallet: call.value, keyName: call.key.name });
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
    logger.error("API Key 测试失败", { err: String(err) });
    return jsonError(err);
  }
}
