/**
 * 号码搜索服务 (规格 §8-§13)
 * - 搜索频率限制: 3 秒最短间隔 + 10 次/分钟/卡密 (规格 §11/§42)
 * - 模式 A/B/C/D 过滤 (规格 §10)
 * - 服务端二次过滤, 不信任 API 异常返回 (原则 6/7)
 * - 结果落 NumberSearchSession (5 分钟有效), 下单时服务端取真实价格 (规格 §12/§13)
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSelectionSettings } from "./settings-service";
import { badRequest, tooManyRequests } from "@/lib/http";
import { minInterval, rateLimit } from "@/lib/ratelimit";
import { toCents } from "@/lib/money";
import { callWithKeys, isKeyLevelError } from "./esim-gateway";
import type { NumberSearchResult } from "@/lib/esim/types";

const SEARCH_SESSION_TTL_MS = 5 * 60 * 1000; // 规格 §13: 5 分钟
const MIN_INTERVAL_MS = 3_000; // 规格 §11
const MAX_PER_MINUTE = 10; // 规格 §11

export class SelectionClosedError extends Error {}

/** 当前是否开放选号 (模式 D 关闭) */
export async function isSelectionOpen(): Promise<boolean> {
  const s = await getSelectionSettings();
  return s.allowFreeNumbers || s.allowPaidNumbers;
}

/**
 * 按免费/付费模式过滤 (规格 §10)
 * A: 免费ON 付费OFF -> 仅 price=0
 * B: 免费ON 付费ON  -> price<=max
 * C: 免费OFF 付费ON -> 0<price<=max
 * D: 均 OFF -> 禁止
 */
export function filterByMode(
  numbers: NumberSearchResult[],
  settings: {
    allowFreeNumbers: boolean;
    allowPaidNumbers: boolean;
    maxPaidNumberPrice: string;
  },
): NumberSearchResult[] {
  const maxCents = toCents(settings.maxPaidNumberPrice);
  return numbers.filter((n) => {
    const cents = toCents(n.price);
    if (settings.allowFreeNumbers && cents === 0) return true;
    if (settings.allowPaidNumbers && cents > 0 && cents <= maxCents) return true;
    return false;
  });
}

export async function searchNumbersForCode(params: {
  codeId: string;
  search: string;
}): Promise<{ numbers: NumberSearchResult[]; expiresAt: Date }> {
  const settings = await getSelectionSettings();
  if (!settings.allowFreeNumbers && !settings.allowPaidNumbers) {
    throw badRequest("SELECTION_CLOSED", "当前暂未开放号码兑换。");
  }

  // 限流 (规格 §11)
  const interval = minInterval(`search:interval:${params.codeId}`, MIN_INTERVAL_MS);
  if (!interval.ok) {
    throw tooManyRequests(interval.retryAfterSec);
  }
  const perMinute = rateLimit(`search:minute:${params.codeId}`, MAX_PER_MINUTE, 60_000);
  if (!perMinute.ok) {
    throw tooManyRequests(perMinute.retryAfterSec);
  }

  const pattern = (params.search ?? "").trim();
  if (pattern && !/^\d{2,12}$/.test(pattern)) {
    throw badRequest("SEARCH_INVALID", "搜索内容仅支持 2-12 位数字");
  }

  // 模式 A 时 zero_price_only=true; 模式 B/C 时 false, 由服务端过滤 (规格 §8/§9)
  const zeroPriceOnly = !settings.allowPaidNumbers;

  // 多 API Key (规格 §71): Key 级错误 (无效/无权限) 自动切换; 余额与搜索无关
  const call = await callWithKeys({
    switchOnDefinitive: isKeyLevelError,
    task: (client) =>
      client.searchNumbers({
        search: pattern || undefined,
        type: settings.numberType,
        zeroPriceOnly,
      }),
  });
  const raw = call.value;

  // 服务端二次过滤 (规格 §8/§9/原则 6/7)
  const filtered = filterByMode(raw, settings);

  // 清理过期会话并落库新会话 (规格 §12)
  await prisma.numberSearchSession.deleteMany({
    where: { redeemCodeId: params.codeId, expiresAt: { lt: new Date() } },
  });

  const expiresAt = new Date(Date.now() + SEARCH_SESSION_TTL_MS);
  await prisma.numberSearchSession.createMany({
    data: filtered.map((n) => ({
      redeemCodeId: params.codeId,
      sessionToken: randomBytes(18).toString("base64url"),
      msisdn: n.msisdn,
      price: n.price,
      expiresAt,
    })),
  });

  return { numbers: filtered, expiresAt };
}
