/**
 * GET /api/admin/profile — 当前管理员账号信息 (规格 §70)
 * PATCH /api/admin/profile — 修改用户名 / 密码 (规格 §70)
 *   - 必须提供当前密码; 用户名与密码可同时修改 (原子生效)
 *   - 当前密码校验失败 5 次 / 10 分钟 / IP 后限流
 *   - 成功后重签发会话 Cookie (用户名变更后导航栏显示新用户名)
 *   - 写审计日志 (规格 §38), 绝不记录密码
 */
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { createAdminSession } from "@/lib/session";
import { updateOwnAccount } from "@/services/admin-service";
import { writeAudit } from "@/services/audit-service";
import { ApiError, badRequest, clientIp, jsonError, jsonOk, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_PASSWORD_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const admin = await requireAdmin();
    return jsonOk({ username: admin.username });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    assertTrustedOrigin(req);
    const ip = clientIp(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const newUsername =
      typeof body.newUsername === "string" ? body.newUsername.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";

    if (!newUsername && !newPassword) {
      throw badRequest("NOTHING_TO_UPDATE", "请填写要修改的用户名或密码");
    }

    let result;
    try {
      result = await updateOwnAccount({
        adminId: session.adminId,
        currentPassword,
        newUsername,
        newPassword,
      });
    } catch (err) {
      // 仅当前密码错误累计限流, 避免暴力破解
      if (err instanceof ApiError && err.code === "CURRENT_PASSWORD_INVALID") {
        logger.warn("账号修改失败: 当前密码错误", { adminId: session.adminId });
        const limit = rateLimit(
          `admin-profile:${ip}`,
          MAX_PASSWORD_FAILURES,
          WINDOW_MS,
        );
        if (!limit.ok) throw tooManyRequests(limit.retryAfterSec);
      }
      throw err;
    }

    if (result.usernameChanged) {
      await writeAudit({
        adminId: session.adminId,
        action: "USERNAME_CHANGE",
        targetType: "admin",
        targetId: session.adminId,
        metadata: { from: session.username, to: result.username },
        ip,
      });
    }
    if (result.passwordChanged) {
      await writeAudit({
        adminId: session.adminId,
        action: "PASSWORD_CHANGE",
        targetType: "admin",
        targetId: session.adminId,
        metadata: { changed: true },
        ip,
      });
    }
    logger.info("管理员账号已修改", {
      adminId: session.adminId,
      usernameChanged: result.usernameChanged,
      passwordChanged: result.passwordChanged,
    });

    // 重签发会话: 刷新 TTL 并同步用户名
    await createAdminSession({
      adminId: session.adminId,
      username: result.username,
    });

    return jsonOk({ username: result.username });
  } catch (err) {
    return jsonError(err);
  }
}
