/**
 * DELETE /api/admin/codes/:id — 删除未使用卡密 (规格 §14)
 */
import { deleteUnusedCode } from "@/services/code-service";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { clientIp, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const { id } = await params;
    await deleteUnusedCode(id);
    await writeAudit({
      adminId: admin.adminId,
      action: "CODE_DELETE",
      targetType: "redeem_code",
      targetId: id,
      ip: clientIp(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
