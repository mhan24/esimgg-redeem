/**
 * GET /api/admin/session — 当前登录状态 (前端守卫用)
 */
import { getAdminSession } from "@/lib/session";
import { jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  return jsonOk({ authenticated: !!session, username: session?.username ?? null });
}
