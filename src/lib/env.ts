/**
 * 环境变量集中访问 (规格 §53)
 * 注意: API Key 不通过环境变量注入, 由管理员在后台配置 (规格 §6)
 */

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: optional("DATABASE_URL"),
  APP_URL: optional("APP_URL", "http://localhost:3100").replace(/\/+$/, ""),
  SESSION_SECRET: optional("SESSION_SECRET"),
  /** 32 字节, hex(64) 或 base64 */
  APP_ENCRYPTION_KEY: optional("APP_ENCRYPTION_KEY"),
  ADMIN_INITIAL_USERNAME: optional("ADMIN_INITIAL_USERNAME", "admin"),
  ADMIN_INITIAL_PASSWORD: optional("ADMIN_INITIAL_PASSWORD"),
  ESIM_API_BASE_URL: optional("ESIM_API_BASE_URL", "https://api.esim.gg/api"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  /**
   * Cloudflare Turnstile (人机验证)
   * 用 getter 而非 optional() 快照: 便于测试在运行时改写 process.env
   * 站点密钥经 GET /api/turnstile/config 下发给前端 (公开信息),
   * 不需要也不应该用 NEXT_PUBLIC_* 构建期内联 (Docker 构建上下文排除了 .env)
   */
  get TURNSTILE_SITE_KEY(): string {
    return process.env.TURNSTILE_SITE_KEY ?? "";
  },
  get TURNSTILE_SECRET_KEY(): string {
    return process.env.TURNSTILE_SECRET_KEY ?? "";
  },
};

/** APP_URL 是否为 https (决定 Cookie Secure 属性) */
export function isHttps(): boolean {
  return env.APP_URL.startsWith("https://");
}

export function requireSessionSecret(): string {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) {
    throw new Error("SESSION_SECRET 未配置或过短 (至少 16 位)");
  }
  return env.SESSION_SECRET;
}
