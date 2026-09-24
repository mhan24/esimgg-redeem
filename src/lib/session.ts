/**
 * 管理员会话 Cookie (规格 §44: HttpOnly / Secure / SameSite=Lax)
 */
import { cookies } from "next/headers";
import { createToken, verifyToken } from "./token";
import { isHttps } from "./env";

const COOKIE_NAME = "esimgg_admin";
const SESSION_TTL_SEC = 12 * 60 * 60; // 12 小时

export interface AdminSession {
  adminId: string;
  username: string;
}

export async function createAdminSession(
  session: AdminSession,
): Promise<string> {
  const { token } = createToken(session, SESSION_TTL_SEC);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return token;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || typeof payload.adminId !== "string") return null;
  return {
    adminId: payload.adminId,
    username: typeof payload.username === "string" ? payload.username : "",
  };
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
