import { ApiError, badRequest } from "@/lib/http";

export const DEFAULT_SUPPORT_URL = "https://t.me/setup0de?direct";
export const DEFAULT_PURCHASE_URL = "https://shop.setup0.de/products/esimgg";
export const DEFAULT_DISCLAIMER = "1. 独立第三方服务：本站提供 esim.gg 官方号码检索、自动化代购及所有权自助转移，与 esim.gg 为独立服务主体。\n2. 资源与服务归属：号码均来自 esim.gg 官方资源。兑换并转移完成后，号码归属你的官方账户；后续充值、资费及网络服务以官方规则与服务条款为准。\n3. 官方自购：如需直接购买，请访问 https://esim.gg。结账可尝试优惠码 SETUP，优惠金额以官方结账页面为准。\n本平台通过 https://github.com/esimgg/api 提供的接口实现自助兑换。";

export interface PublicSiteSettings {
  redemptionPaused: boolean;
  pauseReason: string;
  purchaseUrl: string;
  supportUrl: string;
  disclaimer: string;
}

export interface PublicSiteInfo extends PublicSiteSettings {
  siteName: string;
  initialBalance: string;
}

export function assertRedemptionOpen(settings: Pick<PublicSiteSettings, "redemptionPaused" | "pauseReason">) {
  if (settings.redemptionPaused) {
    throw new ApiError(503, "REDEMPTION_PAUSED", settings.pauseReason.trim() || "兑换暂时暂停，请稍后再试。");
  }
}

export function parseSiteSettings(body: unknown): Omit<PublicSiteSettings, "supportUrl"> & Partial<Pick<PublicSiteSettings, "supportUrl">> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("INVALID_SETTINGS", "设置格式不正确");
  const s = body as Record<string, unknown>;
  if (typeof s.redemptionPaused !== "boolean" || typeof s.pauseReason !== "string" || typeof s.purchaseUrl !== "string" || typeof s.disclaimer !== "string") throw badRequest("INVALID_SETTINGS", "请填写完整的站点设置");
  const pauseReason = s.pauseReason.trim(), purchaseUrl = s.purchaseUrl.trim(), disclaimer = s.disclaimer.trim();
  if (pauseReason.length > 300 || purchaseUrl.length > 2048 || disclaimer.length > 5000) throw badRequest("SETTINGS_TOO_LONG", "暂停原因最多 300 字、链接最多 2048 字、免责声明最多 5000 字");
  const supportUrl = s.supportUrl === undefined ? undefined : typeof s.supportUrl === "string" ? s.supportUrl.trim() : null;
  if (supportUrl === null) throw badRequest("INVALID_SETTINGS", "客服链接须为网址文本");
  if (supportUrl && supportUrl.length > 2048) throw badRequest("SETTINGS_TOO_LONG", "客服链接最多 2048 字");
  for (const [label, value] of [["购买", purchaseUrl], ["客服", supportUrl]] as const) {
    if (!value) continue;
    let url: URL;
    try { url = new URL(value); } catch { throw badRequest("INVALID_URL", `${label}链接须为完整的 http 或 https 地址`); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw badRequest("INVALID_URL", `${label}链接须为不含账号密码的 http 或 https 地址`);
  }
  return { redemptionPaused: s.redemptionPaused, pauseReason, purchaseUrl, disclaimer, ...(supportUrl === undefined ? {} : { supportUrl }) };
}
