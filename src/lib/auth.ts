/**
 * 后台认证助手 + CSRF 防护 (规格 §44 / §45)
 * 方案: HttpOnly + SameSite=Lax Cookie + 变更请求的 Origin 校验
 */
import { getAdminSession, type AdminSession } from "./session";
import { env } from "./env";
import { unauthorized } from "./http";
import { prisma } from "./prisma";

/** 要求已登录管理员; 未登录抛 401 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw unauthorized();
  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, username: true },
  });
  if (!admin) throw unauthorized();
  return { adminId: admin.id, username: admin.username };
}

/** 浏览器写请求必须提供与站点完全一致的 Origin；不再回退 Referer。 */
export function assertTrustedOrigin(req: Request): void {
  if (req.headers.get("origin") !== new URL(env.APP_URL).origin) {
    throw unauthorized("请求来源不受信任");
  }
}
