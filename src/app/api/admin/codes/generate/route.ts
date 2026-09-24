/**
 * POST /api/admin/codes/generate (规格 §14/§49)
 */
import { generateCodes } from "@/services/code-service";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { ApiError, clientIp, jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);

    let body: {
      count?: unknown;
      prefix?: unknown;
      expiresInDays?: unknown;
      remark?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const codes = await generateCodes({
      count: Number(body.count ?? 0),
      prefix: typeof body.prefix === "string" ? body.prefix : "",
      expiresInDays:
        body.expiresInDays === null || body.expiresInDays === undefined
          ? null
          : Number(body.expiresInDays),
      remark: typeof body.remark === "string" ? body.remark : "",
    });

    await writeAudit({
      adminId: admin.adminId,
      action: "CODES_GENERATE",
      targetType: "redeem_code_batch",
      targetId: codes[0]?.batchId ?? undefined,
      metadata: { count: codes.length },
      ip: clientIp(req),
    });
    logger.info("生成卡密", { count: codes.length, batch: codes[0]?.batchId });

    return jsonOk({
      count: codes.length,
      batchId: codes[0]?.batchId ?? null,
      codes: codes.map((c) => c.code),
    });
  } catch (err) {
    return jsonError(err);
  }
}
