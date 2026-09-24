/**
 * 单元测试: esim.gg Client 错误分类 (规格 §59/§26)
 * definitive (明确失败) vs uncertain (结果未知)
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { EsimClient } from "@/lib/esim/client";
import { EsimApiError } from "@/lib/esim/errors";

const BASE = "https://api.esim.gg/api";
const KEY = "esim_test_key";

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init);
  }) as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EsimClient", () => {
  it("getWalletBalance 解析余额", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ currency: "EUR", balance: 123.45 }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new EsimClient(KEY, BASE);
    const wallet = await client.getWalletBalance();
    expect(wallet).toEqual({ currency: "EUR", balance: 123.45 });
  });

  it("请求带 Authorization Bearer 头 (规格 §3)", async () => {
    let seenAuth: string | null = null;
    mockFetch((_url, init) => {
      seenAuth = (init?.headers as Record<string, string>)?.Authorization ?? null;
      return new Response(JSON.stringify({ currency: "EUR", balance: 1 }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    await new EsimClient(KEY, BASE).getWalletBalance();
    expect(seenAuth).toBe(`Bearer ${KEY}`);
  });

  it("searchNumbers 解析列表", async () => {
    let sentBody: unknown;
    mockFetch((_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ success: true, search: [{ msisdn: "372123", price: 0 }] }),
        { headers: { "Content-Type": "application/json" } },
      );
    });
    const result = await new EsimClient(KEY, BASE).searchNumbers({
      search: "372",
      type: "global",
      zeroPriceOnly: true,
    });
    expect(result).toEqual([{ msisdn: "372123", price: 0 }]);
    expect(sentBody).toEqual({ search: "372", type: "global", zero_price_only: true });
  });

  it("4xx -> definitive failure", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: "NUMBER_UNAVAILABLE" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
    );
    await expect(
      new EsimClient(KEY, BASE).purchaseNumber({
        msisdn: "372123",
        rechargeAmount: "0.05",
      }),
    ).rejects.toMatchObject({
      name: "EsimApiError",
      kind: "definitive",
      statusCode: 409,
      errorCode: "NUMBER_UNAVAILABLE",
    });
  });

  it("5xx -> uncertain (必须对账而非重试, 规格 §26)", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: "INTERNAL" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const err = await new EsimClient(KEY, BASE)
      .purchaseNumber({ msisdn: "372123", rechargeAmount: "0.05" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EsimApiError);
    expect(err.kind).toBe("uncertain");
  });

  it("429 -> uncertain", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: "RATE_LIMITED" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const err = await new EsimClient(KEY, BASE)
      .getWalletBalance()
      .catch((e) => e);
    expect(err.kind).toBe("uncertain");
  });

  it("网络错误 -> uncertain", async () => {
    mockFetch(() => {
      throw new Error("connect ECONNRESET");
    });
    const err = await new EsimClient(KEY, BASE)
      .purchaseNumber({ msisdn: "372123", rechargeAmount: "0.05" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EsimApiError);
    expect(err.kind).toBe("uncertain");
  });

  it("2xx 但 success:false -> definitive", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ success: false, error: "REJECTED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const err = await new EsimClient(KEY, BASE)
      .purchaseNumber({ msisdn: "372123", rechargeAmount: "0.05" })
      .catch((e) => e);
    expect(err.kind).toBe("definitive");
    expect(err.errorCode).toBe("REJECTED");
  });

  it("listLines / ownsLine", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ lines: [{ number: "372111" }] }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = new EsimClient(KEY, BASE);
    expect(await client.ownsLine("372111")).toBe(true);
    expect(await client.ownsLine("372999")).toBe(false);
  });

  it("transferOwnership 发送 X-MSISDN 与 recipient_email (规格 §28)", async () => {
    let headers: Record<string, string> = {};
    let body: unknown;
    mockFetch((_url, init) => {
      headers = (init?.headers ?? {}) as Record<string, string>;
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    await new EsimClient(KEY, BASE).transferOwnership({
      msisdn: "37211111111",
      recipientEmail: "user@example.com",
    });
    expect(headers["X-MSISDN"]).toBe("37211111111");
    expect(body).toEqual({ recipient_email: "user@example.com" });
  });

  it("transferOwnership 支持 recipient_account_id 二选一", async () => {
    let body: unknown;
    mockFetch((_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    await new EsimClient(KEY, BASE).transferOwnership({
      msisdn: "37211111111",
      recipientAccountId: "acc-123",
    });
    expect(body).toEqual({ recipient_account_id: "acc-123" });
  });
});
