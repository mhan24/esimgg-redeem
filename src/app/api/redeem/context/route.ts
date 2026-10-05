/**
 * GET /api/redeem/context
 * 当前兑换会话信息 + 前台需要的设置 (初始余额展示)
 */
import { getRedeemSession } from "@/lib/redeem-session";
import { latestActiveOrder } from "@/services/redeem-service";
import { serializeOrder } from "@/lib/serialize";
import { getSelectionSettings } from "@/services/settings-service";
import { jsonError, jsonOk, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getRedeemSession();
    if (!session) throw unauthorized();
    const [settings, order] = await Promise.all([getSelectionSettings(), latestActiveOrder(session.codeId)]);
    return jsonOk({
      order: order ? serializeOrder(order) : null,
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
