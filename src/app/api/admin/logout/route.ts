import { assertTrustedOrigin } from "@/lib/auth";
import { destroyAdminSession } from "@/lib/session";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    await destroyAdminSession();
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
