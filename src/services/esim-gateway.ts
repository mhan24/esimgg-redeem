/**
 * esim.gg 调用网关 (规格 §71)
 *
 * 统一处理多 API Key 的选择与故障转移:
 * - sequential: 从第一个启用的 Key 到最后一个; random: 随机顺序
 * - 余额不足 (预检或购买明确失败) -> 切换到下一个 Key
 * - **结果未知 (超时/网络/5xx/429) 绝不切换 Key** — 必须由原 Key 走 /line/all 对账,
 *   否则会在另一个账户重复购买 (原则 4)
 * - fixedKeyId: 锁定 Key (转移/对账必须用购买时的那个 Key)
 */
import { decryptSecret } from "@/lib/crypto";
import { toCents } from "@/lib/money";
import { logger } from "@/lib/logger";
import { ApiError, serverError } from "@/lib/http";
import { EsimApiError } from "@/lib/esim/errors";
import type { EsimClient } from "@/lib/esim/client";
import {
  clientForKey,
  getKeyStrategy,
  listApiKeys,
  markKeyUsed,
  noKeyError,
  orderKeysByStrategy,
  resolveKey,
  resolveLegacyKey,
  type KeyStrategy,
  type ResolvedKey,
} from "./api-key-service";

export type AttemptOutcome =
  | "success"
  | "insufficient_balance"
  | "key_error"
  | "task_failed";

export interface KeyAttempt {
  keyId: string;
  keyName: string;
  legacy: boolean;
  outcome: AttemptOutcome;
  detail?: string;
}

export interface CallWithKeysResult<T> {
  value: T;
  key: ResolvedKey;
  attempts: KeyAttempt[];
}

export interface CallWithKeysOptions<T> {
  task: (client: EsimClient, key: ResolvedKey) => Promise<T>;
  /** 余额预检阈值 (分); 低于该值的 Key 被跳过 */
  minBalanceCents?: number;
  /** 明确失败时是否值得切换 Key (如余额不足) */
  switchOnDefinitive?: (err: EsimApiError) => boolean;
  /** 锁定 Key (转移/对账); null 表示按策略选择 */
  fixedKeyId?: string | null;
}

/** 余额不足类错误 (esim.gg 可能用 402 或错误码/消息表达) */
export function isInsufficientBalanceError(err: EsimApiError): boolean {
  if (err.statusCode === 402) return true;
  const haystack = `${err.errorCode ?? ""} ${err.message}`.toLowerCase();
  return (
    haystack.includes("insufficient") ||
    haystack.includes("balance") ||
    haystack.includes("funds") ||
    haystack.includes("wallet") ||
    haystack.includes("余额不足") ||
    haystack.includes("recharge")
  );
}

/** Key 级错误 (Key 无效/被撤销/无权限), 换 Key 有意义 */
export function isKeyLevelError(err: EsimApiError): boolean {
  if (err.statusCode === 401 || err.statusCode === 403) return true;
  const haystack = `${err.errorCode ?? ""} ${err.message}`.toLowerCase();
  return (
    haystack.includes("api key") ||
    haystack.includes("api_key") ||
    haystack.includes("apikey") ||
    haystack.includes("unauthorized") ||
    haystack.includes("forbidden") ||
    haystack.includes("invalid token") ||
    haystack.includes("token expired")
  );
}

/** 解析候选 Key 列表 (锁定 / 策略选择 / 旧版兜底) */
async function resolveCandidates(
  strategy: KeyStrategy,
  fixedKeyId?: string | null,
): Promise<ResolvedKey[]> {
  if (fixedKeyId) {
    try {
      return [await resolveKey(fixedKeyId)];
    } catch {
      throw new ApiError(
        409,
        "API_KEY_MISSING",
        "购买时使用的 API Key 已被删除，请联系管理员",
      );
    }
  }

  const enabled = (await listApiKeys()).filter((k) => k.enabled);
  if (enabled.length > 0) {
    return orderKeysByStrategy(enabled, strategy).map((k) => ({
      id: k.id,
      name: k.name,
      apiKey: decryptSecret(k.encryptedKey),
      legacy: false,
    }));
  }

  // 兜底: 旧版单 Key (用户要求保留)
  const legacy = await resolveLegacyKey();
  return legacy ? [legacy] : [];
}

/** 余额预检: ok=true 表示余额充足或无法判定 (继续执行) */
async function checkBalance(
  client: EsimClient,
  key: ResolvedKey,
  minBalanceCents: number,
): Promise<{ ok: boolean; balance?: number; error?: EsimApiError }> {
  try {
    const wallet = await client.getWalletBalance("eur");
    if (toCents(wallet.balance) < minBalanceCents) {
      logger.warn("API Key 余额不足, 切换下一个", {
        keyId: key.id,
        keyName: key.name,
        balance: wallet.balance,
        needCents: minBalanceCents,
      });
      return { ok: false, balance: wallet.balance };
    }
    return { ok: true, balance: wallet.balance };
  } catch (err) {
    if (err instanceof EsimApiError && err.kind === "definitive") {
      // 明确失败: 无法确认余额, 跳过该 Key
      return { ok: false, error: err };
    }
    // 结果未知: 带警告继续用该 Key (最终以购买接口结果为准)
    logger.warn("API Key 余额查询结果未知, 继续尝试", {
      keyId: key.id,
      keyName: key.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: true };
  }
}

export async function callWithKeys<T>(
  options: CallWithKeysOptions<T>,
): Promise<CallWithKeysResult<T>> {
  const strategy = await getKeyStrategy();
  const candidates = await resolveCandidates(strategy, options.fixedKeyId);
  if (candidates.length === 0) throw noKeyError();

  const attempts: KeyAttempt[] = [];
  let insufficient = 0;
  let lastError: unknown = null;

  for (const key of candidates) {
    const client = clientForKey(key);

    // 1. 余额预检 (仅购买类调用)
    if (options.minBalanceCents !== undefined) {
      const check = await checkBalance(client, key, options.minBalanceCents);
      if (!check.ok) {
        insufficient += 1;
        attempts.push({
          keyId: key.id,
          keyName: key.name,
          legacy: key.legacy,
          outcome: "insufficient_balance",
          detail:
            check.error?.message ??
            (check.balance !== undefined ? `余额 €${check.balance}` : undefined),
        });
        continue;
      }
    }

    // 2. 执行任务
    try {
      const value = await options.task(client, key);
      attempts.push({
        keyId: key.id,
        keyName: key.name,
        legacy: key.legacy,
        outcome: "success",
      });
      await markKeyUsed(key.id);
      return { value, key, attempts };
    } catch (err) {
      lastError = err;
      attempts.push({
        keyId: key.id,
        keyName: key.name,
        legacy: key.legacy,
        outcome: "task_failed",
        detail: err instanceof Error ? err.message : String(err),
      });

      // 结果未知: 绝不切换 Key (原则 4), 直接抛出进入对账
      if (!(err instanceof EsimApiError) || err.kind === "uncertain") {
        throw err;
      }
      // 明确失败: 由调用方决定是否值得换 Key
      if (!options.switchOnDefinitive?.(err)) {
        throw err;
      }
      logger.warn("API Key 明确失败, 切换下一个", {
        keyId: key.id,
        keyName: key.name,
        errorCode: err.errorCode,
      });
    }
  }

  // 所有 Key 都不可用
  if (insufficient > 0) {
    logger.error("所有 API Key 余额不足", {
      attempts: attempts.map((a) => ({ key: a.keyName, outcome: a.outcome })),
      needCents: options.minBalanceCents,
    });
    throw new ApiError(
      503,
      "ALL_KEYS_INSUFFICIENT",
      "所有 API Key 余额不足，请联系管理员充值。",
    );
  }
  if (lastError instanceof Error) throw lastError;
  throw serverError("没有可用的 esim.gg API Key");
}
