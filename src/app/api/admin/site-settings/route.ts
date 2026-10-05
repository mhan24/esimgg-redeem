import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { parseSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/services/settings-service";
import { writeAudit } from "@/services/audit-service";
import { badRequest, clientIp, jsonError, jsonOk } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const s = await getSettings();
    return jsonOk({ redemptionPaused: s.redemptionPaused, pauseReason: s.pauseReason, purchaseUrl: s.purchaseUrl, disclaimer: s.disclaimer });
  } catch (err) { return jsonError(err); }
}
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const body = await req.json().catch(() => { throw badRequest("INVALID_JSON", "请求格式错误"); });
    const data = parseSiteSettings(body);
    await prisma.systemSetting.update({ where: { id: 1 }, data });
    await writeAudit({ adminId: admin.adminId, action: "SITE_SETTINGS_UPDATE", targetType: "system_setting", targetId: "1", metadata: { ...data }, ip: clientIp(req) });
    return jsonOk({ ok: true });
  } catch (err) { return jsonError(err); }
}
