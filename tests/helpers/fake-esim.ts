/**
 * Fake esim.gg API (测试替身)
 *
 * 通过 patch globalThis.fetch 拦截 EsimClient 的请求,
 * 覆盖规格 §62 的场景: 正常 / 超时(uncertain) / 明确失败 / 5xx / 429 / 转移失败。
 */
export type PurchaseBehavior =
  | "ok"
  | "timeout"
  | "network-error"
  | "definitive-fail"
  | "insufficient-balance"
  | "server-error"
  | "rate-limited";

export type TransferBehavior = "ok" | "fail" | "timeout";

export interface FakeEsimOptions {
  wallet?: number;
  lines?: string[];
  searchResults?: { msisdn: string; price: number }[];
  purchaseBehavior?: PurchaseBehavior;
  transferBehavior?: TransferBehavior;
  apiKey?: string;
  /** 按 Key 的余额 (规格 §71: 多 Key 故障转移测试用) */
  walletByKey?: Record<string, number>;
  /** 按 Key 的购买行为 (如某个 Key 余额不足) */
  purchaseBehaviorByKey?: Record<string, PurchaseBehavior>;
  /** 购买响应中的实付金额 (规格 §71: total_price) */
  purchaseTotalPrice?: number;
}

export interface FakeEsim {
  wallet: number;
  lines: string[];
  searchResults: { msisdn: string; price: number }[];
  purchaseBehavior: PurchaseBehavior;
  transferBehavior: TransferBehavior;
  apiKey: string;
  walletByKey: Record<string, number>;
  purchaseBehaviorByKey: Record<string, PurchaseBehavior>;
  /** 已调用的端点 (用于断言绝不重复购买) */
  calls: { path: string; body?: unknown; auth?: string | null }[];
  install(): void;
  uninstall(): void;
  purchaseCount(): number;
  /** 用某个 Key 发起的调用次数 */
  callsByKey(apiKey: string): number;
  /** 购买调用使用的 Key 列表 (顺序) */
  purchaseKeys(): (string | null)[];
}

export function createFakeEsim(options: FakeEsimOptions = {}): FakeEsim {
  const fake: FakeEsim = {
    wallet: options.wallet ?? 100,
    lines: [...(options.lines ?? [])],
    searchResults: options.searchResults ?? [
      { msisdn: "37211111111", price: 0 },
      { msisdn: "37222222222", price: 0 },
    ],
    purchaseBehavior: options.purchaseBehavior ?? "ok",
    transferBehavior: options.transferBehavior ?? "ok",
    apiKey: options.apiKey ?? "esim_test_key_abcdef123456",
    walletByKey: { ...(options.walletByKey ?? {}) },
    purchaseBehaviorByKey: { ...(options.purchaseBehaviorByKey ?? {}) },
    calls: [],
    install() {
      globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        // Base URL 为 https://api.esim.gg/api, 路径形如 /api/number/search
        const path = new URL(url).pathname.replace(/^\/api/, "");
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const auth = headers.Authorization ?? headers.authorization ?? null;
        let body: unknown;
        if (typeof init?.body === "string") {
          try {
            body = JSON.parse(init.body);
          } catch {
            body = init.body;
          }
        }
        fake.calls.push({ path, body, auth });

        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        switch (path) {
          case "/wallet/balance": {
            // 按 Key 返回余额 (规格 §71)
            const key = auth?.replace(/^Bearer\s+/i, "") ?? "";
            const balance = fake.walletByKey[key] ?? fake.wallet;
            return json({ currency: "EUR", balance });
          }

          case "/number/search":
            return json({ success: true, search: fake.searchResults });

          case "/checkout/new_line": {
            const msisdn = (body as { msisdn: string }).msisdn;
            const key = auth?.replace(/^Bearer\s+/i, "") ?? "";
            const behavior =
              fake.purchaseBehaviorByKey[key] ?? fake.purchaseBehavior;
            switch (behavior) {
              case "ok":
                fake.lines.push(msisdn);
                // 与真实 API 一致: 返回实付金额 (规格 §71)
                return json({
                  success: true,
                  vat_amount: 0,
                  total_price: options.purchaseTotalPrice ?? 2.99,
                  number_price: 0,
                  redirect_url: "https://esim.gg/lines?success=true",
                });
              case "timeout": {
                const e = new Error("The operation was aborted");
                e.name = "AbortError";
                throw e;
              }
              case "network-error":
                throw new Error("connect ECONNRESET 1.2.3.4:443");
              case "definitive-fail":
                return json(
                  { error: "NUMBER_UNAVAILABLE", message: "number unavailable" },
                  409,
                );
              case "insufficient-balance":
                return json(
                  { error: "INSUFFICIENT_BALANCE", message: "insufficient balance" },
                  402,
                );
              case "server-error":
                return json({ error: "INTERNAL" }, 502);
              case "rate-limited":
                return json({ error: "RATE_LIMITED" }, 429);
            }
            return json({ error: "UNKNOWN" }, 500);
          }

          case "/line/all":
            return json({ lines: fake.lines.map((number) => ({ number })) });

          case "/line/transfer_ownership": {
            const msisdn = headers["X-MSISDN"] ?? headers["x-msisdn"];
            switch (fake.transferBehavior) {
              case "ok":
                fake.lines = fake.lines.filter((n) => n !== msisdn);
                return json({
                  success: true,
                  transfer_details: { number: msisdn },
                });
              case "fail":
                return json(
                  {
                    error: "ACCOUNT_NOT_FOUND",
                    message: "recipient account not found",
                  },
                  404,
                );
              case "timeout": {
                const e = new Error("The operation was aborted");
                e.name = "AbortError";
                throw e;
              }
            }
            return json({ error: "UNKNOWN" }, 500);
          }

          default:
            return json({ error: "NOT_FOUND" }, 404);
        }
      }) as typeof fetch;
    },
    uninstall() {
      // 恢复由 install 前的值无法获取, 测试进程内重启即可
    },
    purchaseCount() {
      return fake.calls.filter((c) => c.path === "/checkout/new_line").length;
    },
    callsByKey(apiKey: string) {
      const bearer = `Bearer ${apiKey}`;
      return fake.calls.filter((c) => c.auth === bearer).length;
    },
    purchaseKeys() {
      return fake.calls
        .filter((c) => c.path === "/checkout/new_line")
        .map((c) => (c.auth ?? "").replace(/^Bearer\s+/i, "") || null);
    },
  };
  return fake;
}
