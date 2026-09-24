/**
 * esim.gg API Key 多账号服务 (规格 §71)
 *
 * - Key 明文只在内存, 落库 AES-256-GCM 加密 (规格 §46)
 * - 策略 sequential (从第一个到最后一个) / random (随机)
 * - 余额不足或明确失败时由 esim-gateway 负责切换
 * - 旧版单 Key (SystemSetting.encryptedEsimApiKey) 保留作兜底
 */
import type { EsimApiKey, Prisma, SystemSetting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { EsimClient } from "@/lib/esim/client";
import { ApiError, badRequest, notFound, serverError } from "@/lib/http";
import { getSettings } from "./settings-service";
import { logger } from "@/lib/logger";

export type KeyStrategy = "sequential" | "random";

export const KEY_STRATEGIES: KeyStrategy[] = ["sequential", "random"];

/** 列表用视图: 绝不含明文 Key */
export interface ApiKeyView {
  id: string;
  name: string;
  maskedKey: string;
  enabled: boolean;
  sortOrder: number;
  lastUsedAt: string | null;
  lastBalance: string | null;
  lastBalanceAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** 已解密的 Key (仅服务端内部使用) */
export interface ResolvedKey {
  id: string;
  name: string;
  apiKey: string;
  /** true 表示来自旧版单 Key 兜底 */
  legacy: boolean;
}

export function toApiKeyView(key: EsimApiKey): ApiKeyView {
  return {
    id: key.id,
    name: key.name,
    maskedKey: maskSecret(decryptSecret(key.encryptedKey)),
    enabled: key.enabled,
    sortOrder: key.sortOrder,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    lastBalance: key.lastBalance?.toString() ?? null,
    lastBalanceAt: key.lastBalanceAt?.toISOString() ?? null,
    lastError: key.lastError,
    createdAt: key.createdAt.toISOString(),
  };
}

/** 读取多 Key 策略 (非法值回退 sequential) */
export async function getKeyStrategy(): Promise<KeyStrategy> {
  const settings = await getSettings();
  return settings.keyStrategy === "random" ? "random" : "sequential";
}

export async function listApiKeys(): Promise<EsimApiKey[]> {
  return prisma.esimApiKey.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function listApiKeyViews(): Promise<ApiKeyView[]> {
  const keys = await listApiKeys();
  return keys.map(toApiKeyView);
}

export async function getApiKey(id: string): Promise<EsimApiKey> {
  const key = await prisma.esimApiKey.findUnique({ where: { id } });
  if (!key) throw notFound("API Key 不存在");
  return key;
}

/** 解密单个 Key (内部使用) */
export async function resolveKey(id: string): Promise<ResolvedKey> {
  const key = await getApiKey(id);
  return { id: key.id, name: key.name, apiKey: decryptSecret(key.encryptedKey), legacy: false };
}

export async function createApiKey(input: {
  name: string;
  apiKey: string;
}): Promise<EsimApiKey> {
  const name = input.name.trim();
  const apiKey = input.apiKey.trim();
  if (!name || name.length > 40) {
    throw badRequest("KEY_NAME_INVALID", "备注名 1-40 字符");
  }
  if (apiKey.length < 8) {
    throw badRequest("API_KEY_INVALID", "API Key 格式不正确");
  }
  const last = await prisma.esimApiKey.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.esimApiKey.create({
    data: {
      name,
      encryptedKey: encryptSecret(apiKey),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function renameApiKey(id: string, name: string): Promise<EsimApiKey> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) {
    throw badRequest("KEY_NAME_INVALID", "备注名 1-40 字符");
  }
  await getApiKey(id);
  return prisma.esimApiKey.update({ where: { id }, data: { name: trimmed } });
}

export async function setApiKeyEnabled(id: string, enabled: boolean): Promise<EsimApiKey> {
  await getApiKey(id);
  return prisma.esimApiKey.update({ where: { id }, data: { enabled } });
}

/** 上移/下移 (与相邻项交换 sortOrder) */
export async function moveApiKey(id: string, direction: "up" | "down"): Promise<EsimApiKey[]> {
  const keys = await listApiKeys();
  const index = keys.findIndex((k) => k.id === id);
  if (index === -1) throw notFound("API Key 不存在");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= keys.length) return keys; // 已在边界, 无需调整

  const a = keys[index];
  const b = keys[target];
  await prisma.$transaction([
    prisma.esimApiKey.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.esimApiKey.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  return listApiKeys();
}

/**
 * 删除 Key。
 * 该 Key 名下还有「未完成转移」的订单时禁止删除 (号码仍在它账户下, 删除后将无法转移)。
 * 已完成/失败的订单会随之外键置空, 不影响历史数据。
 */
export async function deleteApiKey(id: string): Promise<{ detachedOrders: number }> {
  const key = await getApiKey(id);
  const pendingOrders = await prisma.order.count({
    where: {
      apiKeyId: id,
      status: { in: ["PURCHASED", "TRANSFER_FAILED", "TRANSFERRING", "PURCHASE_UNCERTAIN"] },
    },
  });
  if (pendingOrders > 0) {
    throw badRequest(
      "KEY_IN_USE",
      `该 Key 还有 ${pendingOrders} 个订单未完成转移，不能删除`,
    );
  }
  const detachedOrders = await prisma.order.count({ where: { apiKeyId: id } });
  await prisma.esimApiKey.delete({ where: { id } });
  logger.info("API Key 已删除", { keyId: id, name: key.name, detachedOrders });
  return { detachedOrders };
}

/** 构造某个 Key 的客户端 */
export function clientForKey(key: ResolvedKey): EsimClient {
  return new EsimClient(key.apiKey);
}

/** 按策略排序启用的 Key (sequential: sortOrder; random: 洗牌) */
export function orderKeysByStrategy<T extends { id: string }>(
  keys: T[],
  strategy: KeyStrategy,
): T[] {
  if (strategy === "random") {
    const copy = [...keys];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  return keys; // listApiKeys 已按 sortOrder 排序
}

/**
 * 旧版单 Key 兜底 (用户要求保留):
 * 新表没有任何启用 Key 时回退到 SystemSetting.encryptedEsimApiKey
 */
export async function resolveLegacyKey(): Promise<ResolvedKey | null> {
  const settings: SystemSetting = await getSettings();
  if (!settings.encryptedEsimApiKey) return null;
  try {
    return {
      id: "legacy",
      name: "旧版 Key",
      apiKey: decryptSecret(settings.encryptedEsimApiKey),
      legacy: true,
    };
  } catch {
    logger.error("旧版 API Key 解密失败");
    return null;
  }
}

/** 无任何可用 Key */
export function noKeyError(): ApiError {
  return serverError("尚未配置 esim.gg API Key，请联系管理员");
}

/** 记录 Key 使用情况 (失败不影响主流程) */
export async function markKeyUsed(id: string): Promise<void> {
  if (id === "legacy") return;
  try {
    await prisma.esimApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date(), lastError: null },
    });
  } catch {
    // 忽略
  }
}

/** 刷新并回写某个 Key 的余额 (后台「检测余额」用) */
export async function refreshKeyBalance(id: string): Promise<{ balance: number; currency: string }> {
  const key = await resolveKey(id);
  const client = clientForKey(key);
  try {
    const wallet = await client.getWalletBalance("eur");
    await prisma.esimApiKey.update({
      where: { id },
      data: {
        lastBalance: wallet.balance,
        lastBalanceAt: new Date(),
        lastError: null,
      },
    });
    return { balance: wallet.balance, currency: wallet.currency };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.esimApiKey.update({
      where: { id },
      data: { lastError: message.slice(0, 200), lastBalanceAt: new Date() },
    });
    throw err;
  }
}

/** 低余额 Key (用于预警) */
export async function findLowBalanceKeys(
  threshold: number,
): Promise<ApiKeyView[]> {
  const keys = await listApiKeys();
  return keys
    .filter((k) => k.enabled && k.lastBalance !== null && Number(k.lastBalance) < threshold)
    .map(toApiKeyView);
}

/** 策略与阈值的持久化 (后台设置) */
export async function updateKeySettings(input: {
  keyStrategy?: unknown;
  keyLowBalanceThreshold?: unknown;
}): Promise<{ keyStrategy: KeyStrategy; keyLowBalanceThreshold: string }> {
  const update: Prisma.SystemSettingUpdateInput = {};
  const create: Prisma.SystemSettingCreateInput = { id: 1 };

  if (input.keyStrategy !== undefined) {
    const v = String(input.keyStrategy);
    if (!KEY_STRATEGIES.includes(v as KeyStrategy)) {
      throw badRequest("KEY_STRATEGY_INVALID", "调用策略仅支持 sequential / random");
    }
    update.keyStrategy = v;
    create.keyStrategy = v;
  }
  if (input.keyLowBalanceThreshold !== undefined) {
    const n = Number(input.keyLowBalanceThreshold);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      throw badRequest("KEY_THRESHOLD_INVALID", "低余额预警阈值格式不正确");
    }
    update.keyLowBalanceThreshold = n;
    create.keyLowBalanceThreshold = n;
  }

  if (Object.keys(update).length === 0) {
    const current = await getSettings();
    return {
      keyStrategy: current.keyStrategy === "random" ? "random" : "sequential",
      keyLowBalanceThreshold: current.keyLowBalanceThreshold.toString(),
    };
  }
  // upsert: 设置单例缺失时自动创建 (首次部署/测试环境)
  const updated = await prisma.systemSetting.upsert({
    where: { id: 1 },
    update,
    create,
  });
  return {
    keyStrategy: updated.keyStrategy === "random" ? "random" : "sequential",
    keyLowBalanceThreshold: updated.keyLowBalanceThreshold.toString(),
  };
}
