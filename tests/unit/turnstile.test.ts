/**
 * 单元测试: Cloudflare Turnstile 服务端校验
 */
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  extractTurnstileToken,
  isTurnstileEnabled,
  verifyTurnstile,
} from "@/lib/turnstile";
import { GET as configGET } from "@/app/api/turnstile/config/route";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;

function stubFetch(impl: () => unknown) {
  const mock = vi.fn(async () => impl());
  vi.stubGlobal("fetch", mock);
  return mock;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET;
});

describe("turnstile", () => {
  it("未配置密钥时跳过校验 (不请求 Cloudflare)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchMock = stubFetch(() => jsonResponse({ success: true }));
    const result = await verifyTurnstile(undefined, "1.2.3.4");
    expect(result).toEqual({ ok: true, skipped: true });
    expect(isTurnstileEnabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缺少 token 时拒绝且不请求 Cloudflare", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = stubFetch(() => jsonResponse({ success: true }));
    const result = await verifyTurnstile(undefined);
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toContain("missing-input-response");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("空白 token 同样拒绝", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const result = await verifyTurnstile("   ");
    expect(result.ok).toBe(false);
  });

  it("校验通过: 正确提交 secret/response/remoteip", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = stubFetch(() => jsonResponse({ success: true }));
    const result = await verifyTurnstile("token-abc", "1.2.3.4");
    expect(result).toEqual({ ok: true, errorCodes: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(VERIFY_URL);
    expect(init.method).toBe("POST");
    const form = init.body as URLSearchParams;
    expect(form.get("secret")).toBe("secret");
    expect(form.get("response")).toBe("token-abc");
    expect(form.get("remoteip")).toBe("1.2.3.4");
  });

  it("未传 IP 时不提交 remoteip", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = stubFetch(() => jsonResponse({ success: true }));
    await verifyTurnstile("token-abc");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("success:false 时拒绝并带回错误码", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    stubFetch(() =>
      jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    const result = await verifyTurnstile("bad-token", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });

  it("HTTP 非 2xx 时失败关闭", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    stubFetch(() => jsonResponse({}, 500));
    const result = await verifyTurnstile("token-abc", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toEqual(["verify-http-error"]);
  });

  it("网络异常时失败关闭", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    stubFetch(() => Promise.reject(new Error("network down")));
    const result = await verifyTurnstile("token-abc", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toEqual(["verify-network-error"]);
  });

  it("isTurnstileEnabled 随密钥配置变化", () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(isTurnstileEnabled()).toBe(false);
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(isTurnstileEnabled()).toBe(true);
  });
});

describe("GET /api/turnstile/config", () => {
  const originalSiteKey = process.env.TURNSTILE_SITE_KEY;

  afterEach(() => {
    if (originalSiteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = originalSiteKey;
  });

  it("两项都配置时返回 enabled 与站点密钥", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.TURNSTILE_SITE_KEY = "site-key";
    const res = await configGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true, siteKey: "site-key" });
  });

  it("缺少任一项时返回 enabled:false 且不下发站点密钥", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    delete process.env.TURNSTILE_SITE_KEY;
    let data = await (await configGET()).json();
    expect(data).toEqual({ enabled: false, siteKey: "" });

    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.TURNSTILE_SITE_KEY = "site-key";
    data = await (await configGET()).json();
    expect(data).toEqual({ enabled: false, siteKey: "" });
  });

  it("绝不返回密钥", async () => {
    process.env.TURNSTILE_SECRET_KEY = "super-secret";
    process.env.TURNSTILE_SITE_KEY = "site-key";
    const text = await (await configGET()).text();
    expect(text).not.toContain("super-secret");
  });
});

describe("extractTurnstileToken", () => {
  it("取出字符串 token", () => {
    expect(extractTurnstileToken({ turnstileToken: "abc" })).toBe("abc");
  });
  it("缺失/非字符串返回 undefined", () => {
    expect(extractTurnstileToken({})).toBeUndefined();
    expect(extractTurnstileToken({ turnstileToken: 123 })).toBeUndefined();
    expect(extractTurnstileToken(null)).toBeUndefined();
    expect(extractTurnstileToken("x")).toBeUndefined();
  });
});
