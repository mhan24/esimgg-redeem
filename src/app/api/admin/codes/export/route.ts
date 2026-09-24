/**
 * GET /api/admin/codes/export?format=txt|csv (规格 §14)
 */
import { exportCodes } from "@/services/code-service";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { clientIp, jsonError } from "@/lib/http";
import type { RedeemCodeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: RedeemCodeStatus[] = [
  "UNUSED",
  "LOCKED",
  "PURCHASED",
  "USED",
  "DISABLED",
];

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "txt";
    const statusParam = url.searchParams.get("status") ?? undefined;
    const status = STATUSES.includes(statusParam as RedeemCodeStatus)
      ? (statusParam as RedeemCodeStatus)
      : undefined;

    const file = await exportCodes({
      format,
      status,
      batchId: url.searchParams.get("batchId") ?? undefined,
    });

    await writeAudit({
      adminId: admin.adminId,
      action: "CODES_EXPORT",
      targetType: "redeem_code",
      metadata: { format, status: status ?? "ALL" },
      ip: clientIp(req),
    });

    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
