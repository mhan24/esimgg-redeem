import { ApiError, badRequest } from "@/lib/http";

export const DEFAULT_SUPPORT_URL = "https://t.me/setup0de?direct";
export const DEFAULT_PURCHASE_URL = "https://shop.setup0.de/products/esimgg";
export const DEFAULT_DISCLAIMER = "本站是使用 https://github.com/esimgg/api 进行的二次开发，通过搜寻号码、订购号码、转移线路所有权三项功能实现的自助转移，兑换号码均为 esim.gg 官方资源，余额为站点普通用户钱包。和官方购买并无二异（仅获得部分功能白名单），如不信任可以去官方自行购买，官方地址 https://esim.gg，优惠码可以用 SETUP，会优惠 0.4 欧元。";

export interface PublicSiteSettings {
  redemptionPaused: boolean;
  pauseReason: string;
  purchaseUrl: string;
  supportUrl: string;
  disclaimer: string;
}

export interface PublicSiteInfo extends PublicSiteSettings {
  siteName: string;
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
