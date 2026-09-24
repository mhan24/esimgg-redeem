/**
 * POST /api/admin/codes/:id/enable (规格 §14/§49)
 */
import { setCodeStatus } from "@/services/code-service";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { clientIp, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;
    const code = await setCodeStatus(id, "UNUSED");
    await writeAudit({
      adminId: admin.adminId,
      action: "CODE_ENABLE",
      targetType: "redeem_code",
      targetId: id,
      ip: clientIp(req),
    });
    return jsonOk({ id: code.id, status: code.status });
  } catch (err) {
    return jsonError(err);
  }
}
