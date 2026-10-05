import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { sendTelegramTest } from "@/services/telegram-service";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    assertTrustedOrigin(req);
    await sendTelegramTest();
    return jsonOk({ ok: true });
  } catch (err) { return jsonError(err); }
}
