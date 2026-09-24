/**
 * GET /api/admin/esim/wallet (规格 §5/§71)
 * 钱包余额经多 Key 网关获取 (策略选择/失败切换)
 */
import { requireAdmin } from "@/lib/auth";
import { callWithKeys } from "@/services/esim-gateway";
import { EsimApiError } from "@/lib/esim/errors";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const call = await callWithKeys({
      task: (client) => client.getWalletBalance("eur"),
    });
    return jsonOk({ wallet: call.value, keyName: call.key.name });
  } catch (err) {
    if (err instanceof EsimApiError) {
      return jsonOk({
        wallet: null,
        error: err.errorCode ?? "ESIM_API_ERROR",
        message: err.message,
      });
    }
    return jsonError(err);
  }
}
