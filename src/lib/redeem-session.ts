/**
 * 用户兑换会话 ( redeem code 验证通过后签发, 规格 §20/§48 )
 * 绑定 redeemCodeId + code, 后续搜索/下单请求据此识别卡密,
 * 避免客户端反复提交卡密原文
 */
import { cookies } from "next/headers";
import { createToken, verifyToken } from "./token";
import { isHttps } from "./env";

const COOKIE_NAME = "esimgg_redeem";
const REDEEM_TTL_SEC = 60 * 60; // 1 小时

export interface RedeemSession {
  codeId: string;
  code: string;
}

export async function createRedeemSession(session: RedeemSession): Promise<void> {
  const { token } = createToken(session, REDEEM_TTL_SEC);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: REDEEM_TTL_SEC,
  });
}

export async function getRedeemSession(): Promise<RedeemSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || typeof payload.codeId !== "string") return null;
  return {
    codeId: payload.codeId,
    code: typeof payload.code === "string" ? payload.code : "",
  };
}

export async function destroyRedeemSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
