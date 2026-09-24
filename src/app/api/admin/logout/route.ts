/**
 * POST /api/admin/logout (规格 §49)
 */
import { destroyAdminSession } from "@/lib/session";
import { jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroyAdminSession();
  return jsonOk({ ok: true });
}
