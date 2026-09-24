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

/** 邮箱格式 (后台手动重试时仍可选使用) */
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
  return value.length >= 8 && value.length <= 72;
}
