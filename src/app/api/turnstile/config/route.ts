/**
 * GET /api/turnstile/config
 * 向前台下发作废判断所需的公开配置: 是否启用 + 站点密钥
 * 站点密钥 (site key) 本身就是公开信息, 随 HTML/JS 下发亦无安全风险;
 * 密钥 (secret key) 仅存在于服务端, 绝不通过本接口返回。
 */
import { env } from "@/lib/env";
import { jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const secretConfigured = env.TURNSTILE_SECRET_KEY.length > 0;
  const siteKey = env.TURNSTILE_SITE_KEY;
  return jsonOk({
    // 只有密钥与站点密钥都配置了才真正启用
    enabled: secretConfigured && siteKey.length > 0,
    siteKey: secretConfigured ? siteKey : "",
  });
}
