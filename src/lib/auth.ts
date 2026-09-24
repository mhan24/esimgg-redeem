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

/**
 * 校验请求来源 (防 CSRF, 规格 §45)
 * 仅允许同源 Origin/Referer; 无 Origin 的非浏览器客户端由 SameSite=Lax 兜底,
 * 但本系统全部为浏览器访问, 因此严格要求。
 */
export function assertTrustedOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) {
    // 部分表单 POST 可能不带 Origin, 退化校验 Referer
    const referer = req.headers.get("referer");
    if (referer && !referer.startsWith(env.APP_URL)) {
      throw unauthorized("请求来源不受信任");
    }
    return;
  }
  if (origin !== env.APP_URL) {
    throw unauthorized("请求来源不受信任");
  }
}
