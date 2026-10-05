import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Prisma, type Order } from "@prisma/client";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), transaction: vi.fn(), findOrder: vi.fn(), gateway: vi.fn() }));
vi.mock("@/services/settings-service", () => ({ getSettings: mocks.settings }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: () => "123456:secret-token" }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/services/esim-gateway", () => ({ callWithKeys: mocks.gateway }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  order: { findUnique: mocks.findOrder, update: vi.fn() },
  redeemCode: { updateMany: vi.fn() },
} }));
import { notifyCodeUsed, sendTelegramMessage } from "@/services/telegram-service";
import { transferOrder } from "@/services/transfer-service";

const order = {
  id: "order-1", redeemCodeId: "code-1", msisdn: "12345678901",
  numberPrice: new Prisma.Decimal("1.00"), initialBalance: new Prisma.Decimal("0.50"),
  completedAt: new Date("2026-09-27T00:00:00Z"), recipientEmail: "private@example.com", status: "PURCHASED",
} as Order;
const request = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", request);
  request.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  mocks.settings.mockResolvedValue({ telegramEnabled: true, encryptedTelegramToken: "encrypted", telegramChatId: "-1001234", siteName: "Test" });
  mocks.findOrder.mockResolvedValue(order);
  mocks.gateway.mockResolvedValue({ value: false });
});
afterEach(() => vi.unstubAllGlobals());

it("does not send when disabled", async () => {
  mocks.settings.mockResolvedValue({ telegramEnabled: false });
  await notifyCodeUsed(order);
  expect(request).not.toHaveBeenCalled();
});
it("sends to configured destination and excludes private recipient and full number", async () => {
  await notifyCodeUsed(order);
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.chat_id).toBe("-1001234");
  expect(body.text).toContain("****8901");
  expect(body.text).not.toContain(order.msisdn);
  expect(body.text).not.toContain(order.recipientEmail);
});
it("keeps completed redemption successful when Telegram fails", async () => {
  mocks.transaction.mockResolvedValue([{ ...order, status: "COMPLETED" }, { count: 1 }]);
  request.mockRejectedValue(new Error("network failure with secret-token"));
  await expect(transferOrder(order.id)).resolves.toMatchObject({ status: "COMPLETED" });
});
it("sends only for the transaction that changed the code to USED", async () => {
  mocks.transaction.mockResolvedValueOnce([order, { count: 1 }]).mockResolvedValueOnce([order, { count: 0 }]);
  await transferOrder(order.id);
  await transferOrder(order.id);
  expect(request).toHaveBeenCalledTimes(1);
});
it("sanitizes network failures and rejects Telegram ok:false", async () => {
  request.mockRejectedValueOnce(new Error("https://api.telegram.org/botSECRET/sendMessage"));
  await expect(sendTelegramMessage("SECRET", "1", "test")).rejects.toMatchObject({ code: "TELEGRAM_SEND_FAILED" });
  request.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) });
  await expect(sendTelegramMessage("SECRET", "1", "test")).rejects.toThrow("通知发送失败");
});
