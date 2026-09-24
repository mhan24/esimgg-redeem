/**
 * GET /api/redeem/context
 * 当前兑换会话信息 + 前台需要的设置 (初始余额展示)
 */
import { getRedeemSession } from "@/lib/redeem-session";
import { getSelectionSettings } from "@/services/settings-service";
import { jsonError, jsonOk, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getRedeemSession();
    if (!session) throw unauthorized();
    const settings = await getSelectionSettings();
    return jsonOk({
      settings: {
        initialBalance: settings.initialBalance,
        allowFreeNumbers: settings.allowFreeNumbers,
        allowPaidNumbers: settings.allowPaidNumbers,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
