/**
 * POST /api/admin/login (规格 §44/§49/§69)
 * 限流: 单 IP 5 次失败 / 10 分钟
 * 人机验证: Cloudflare Turnstile (规格 §69)
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/session";
import { assertTrustedOrigin } from "@/lib/auth";
import {
  ApiError,
  clientIp,
  jsonError,
  jsonOk,
  tooManyRequests,
  unauthorized,
} from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { extractTurnstileToken, verifyTurnstile } from "@/lib/turnstile";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    const ip = clientIp(req);
    const limit = rateLimit(`admin-login:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!limit.ok) throw tooManyRequests(limit.retryAfterSec);

    let body: { username?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      throw unauthorized("用户名或密码错误");
    }

    // 人机验证 (未配置密钥时自动跳过)
    const turnstile = await verifyTurnstile(extractTurnstileToken(body), ip);
    if (!turnstile.ok) {
      throw unauthorized("人机验证未通过，请重试");
    }

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      logger.warn("管理员登录失败: 用户不存在", { username });
      throw unauthorized("用户名或密码错误");
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      logger.warn("管理员登录失败: 密码错误", { username });
      throw unauthorized("用户名或密码错误");
    }

    await createAdminSession({ adminId: admin.id, username: admin.username });
    logger.info("管理员登录成功", { username });
    return jsonOk({ username: admin.username });
  } catch (err) {
    return jsonError(err);
  }
}
