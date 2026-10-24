import { badRequest } from "./http";

/**
 * 输入校验助手
 */

/** 规范化 UserID: 去空白/内部空格 (用户可能从弹窗复制时带入空格) */
export function normalizeUserid(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, "");
}

/**
 * UserID 格式校验 (cm 开头, 字母数字)
 * 宽松校验: 具体是否存在由 esim.gg API 判定, 错误会反馈到订单日志
 */
export function isValidUserid(value: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(value);
}

/** 邮箱格式 (兑换及转移重试可使用) */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** 号码格式 (E.164 数字) */
export function isValidMsisdn(value: string): boolean {
  return /^\d{6,15}$/.test(value);
}

/**
 * 管理员用户名 (规格 §70): 3-32 位字母/数字/下划线/连字符
 * 不含空白与中文, 避免登录时输入歧义
 */
export function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9_-]{3,32}$/.test(value);
}

/**
 * 管理员密码 (规格 §70): 8-72 位
 * 下限与 seed 的 ADMIN_INITIAL_PASSWORD 规则一致; 上限因 bcrypt 只取前 72 字节
 */
export function isValidPassword(value: string): boolean {
  return value.length >= 8 && new TextEncoder().encode(value).length <= 72;
}

/** 兑换和重试共用的接收方输入契约；不接受旧 accountId 别名。 */
export function parseRecipient(body: unknown): { userid: string; email: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("BAD_REQUEST", "请求格式错误");
  }
  const input = body as Record<string, unknown>;
  if ("accountId" in input) {
    throw badRequest("RECIPIENT_FIELD_REMOVED", "请使用 userid 或 email 字段");
  }
  for (const field of ["userid", "email"] as const) {
    if (input[field] !== undefined && typeof input[field] !== "string") {
      throw badRequest("RECIPIENT_INVALID", "接收方格式不正确");
    }
  }
  const userid = normalizeUserid(input.userid);
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (userid && email) throw badRequest("RECIPIENT_CONFLICT", "UserID 与邮箱只能填写其中一项");
  if (!userid && !email) throw badRequest("RECIPIENT_REQUIRED", "请填写接收 UserID 或邮箱");
  if (userid && !isValidUserid(userid)) throw badRequest("USERID_INVALID", "UserID 格式不正确");
  if (email && !isValidEmail(email)) throw badRequest("EMAIL_INVALID", "邮箱格式不正确");
  return { userid, email };
}
