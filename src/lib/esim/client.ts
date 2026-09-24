/**
 * esim.gg Customer API 客户端 (规格 §58)
 * 所有请求经服务端; 业务代码禁止直接 fetch (规格 §46)
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { EsimApiError, parseEsimErrorBody } from "./errors";
import type {
  LineInfo,
  NumberSearchResult,
  PurchaseNumberParams,
  PurchaseResult,
  SearchNumbersParams,
  TransferOwnershipParams,
  WalletBalance,
} from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;
/** 购买接口超时后结果未知, 需要单独的对账流程, 超时稍短以便快速进入对账 */
const PURCHASE_TIMEOUT_MS = 30_000;

export class EsimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = env.ESIM_API_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST";
      body?: unknown;
      msisdn?: string;
      timeoutMs?: number;
      /** 购买类请求: 超时/网络失败归类为 uncertain */
    } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.msisdn) {
      headers["X-MSISDN"] = options.msisdn;
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      let payload: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (!res.ok) {
        const { errorCode, message } = parseEsimErrorBody(payload);
        const msg = `esim.gg API ${res.status}: ${message ?? res.statusText}`;
        logger.warn("esim api 错误响应", {
          path,
          status: res.status,
          errorCode,
        });
        // 4xx (除 408/429) 视为明确失败; 5xx / 429 / 408 结果未知
        if (
          res.status >= 500 ||
          res.status === 429 ||
          res.status === 408 ||
          res.status === 425
        ) {
          throw EsimApiError.uncertain(msg, res.status, errorCode, payload);
        }
        throw EsimApiError.definitive(msg, res.status, errorCode, payload);
      }

      // 2xx 但 body 显式 success:false -> 明确的业务失败
      if (
        payload &&
        typeof payload === "object" &&
        (payload as Record<string, unknown>).success === false
      ) {
        const { errorCode, message } = parseEsimErrorBody(payload);
        throw EsimApiError.definitive(
          message ?? "esim.gg API 返回失败",
          res.status,
          errorCode,
          payload,
        );
      }

      return payload as T;
    } catch (err) {
      if (err instanceof EsimApiError) throw err;
      // 超时 / 网络错误 -> 结果未知
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
      const msg = isAbort
        ? `esim.gg API 请求超时 (${path})`
        : `esim.gg API 网络错误 (${path}): ${err instanceof Error ? err.message : String(err)}`;
      logger.warn("esim api 网络/超时", { path, isAbort });
      throw EsimApiError.uncertain(msg, undefined, isAbort ? "TIMEOUT" : "NETWORK_ERROR", undefined, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** GET /wallet/balance?currency=eur */
  async getWalletBalance(currency = "eur"): Promise<WalletBalance> {
    const data = await this.request<WalletBalance>(
      `/wallet/balance?currency=${encodeURIComponent(currency)}`,
    );
    return {
      currency: typeof data?.currency === "string" ? data.currency : currency.toUpperCase(),
      balance: Number(data?.balance ?? 0),
    };
  }

  /** POST /number/search */
  async searchNumbers(params: SearchNumbersParams): Promise<NumberSearchResult[]> {
    const data = await this.request<{ search?: NumberSearchResult[] }>(
      "/number/search",
      {
        method: "POST",
        body: {
          ...(params.search ? { search: params.search } : {}),
          type: params.type,
          zero_price_only: params.zeroPriceOnly,
        },
      },
    );
    const list = Array.isArray(data?.search) ? data.search : [];
    return list
      .filter((n) => n && typeof n.msisdn === "string")
      .map((n) => ({
        msisdn: n.msisdn,
        price: Number(n.price ?? 0),
      }));
  }

  /**
   * POST /checkout/new_line (规格 §24/§26)
   * 注意: 超时/不确定响应时调用方必须走 /line/all 对账, 不得直接重试
   */
  async purchaseNumber(params: PurchaseNumberParams): Promise<PurchaseResult> {
    const data = await this.request<unknown>("/checkout/new_line", {
      method: "POST",
      body: {
        msisdn: params.msisdn,
        payment_method: "wallet",
        recharge_amount: params.rechargeAmount,
      },
      timeoutMs: PURCHASE_TIMEOUT_MS,
    });
    return { raw: data };
  }

  /** GET /line/all */
  async listLines(): Promise<LineInfo[]> {
    const data = await this.request<{ lines?: LineInfo[] }>("/line/all");
    return Array.isArray(data?.lines) ? data.lines : [];
  }

  /** GET /line/get_line (X-MSISDN) */
  async getLine(msisdn: string): Promise<unknown> {
    return this.request<unknown>("/line/get_line", { msisdn });
  }

  /** 号码是否已属于当前账户 (对账用, 规格 §27) */
  async ownsLine(msisdn: string): Promise<boolean> {
    const lines = await this.listLines();
    return lines.some((l) => String(l.number) === msisdn);
  }

  /** POST /line/transfer_ownership (规格 §28) */
  async transferOwnership(params: TransferOwnershipParams): Promise<unknown> {
    const body =
      params.recipientAccountId !== undefined
        ? { recipient_account_id: params.recipientAccountId }
        : { recipient_email: params.recipientEmail };
    return this.request<unknown>("/line/transfer_ownership", {
      method: "POST",
      msisdn: params.msisdn,
      body,
    });
  }
}
