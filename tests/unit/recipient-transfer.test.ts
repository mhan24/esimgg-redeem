import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), gateway: vi.fn(), transfer: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  order: { findUnique: mocks.find, update: mocks.update },
  redeemCode: { updateMany: vi.fn() }, $transaction: mocks.transaction,
} }));
vi.mock("@/services/telegram-service", () => ({ notifyCodeUsed: vi.fn() }));
vi.mock("@/services/esim-gateway", () => ({ callWithKeys: mocks.gateway }));
import { transferOrder } from "@/services/transfer-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockResolvedValue([{ status: "COMPLETED" }, { count: 1 }]);
  mocks.gateway.mockImplementation(async ({ task }) => ({ value: await task({ ownsLine: async () => true, transferOwnership: mocks.transfer }) }));
});

it.each([
  [{ recipientAccountId: "cmOldAccount", recipientEmail: null }, { recipientEmail: "new@example.com" }, { recipientEmail: "new@example.com", recipientAccountId: undefined }],
  [{ recipientAccountId: null, recipientEmail: "old@example.com" }, { recipientAccountId: "cmNewAccount" }, { recipientAccountId: "cmNewAccount", recipientEmail: undefined }],
])("replaces the previous recipient when switching methods", async (previous, replacement, expected) => {
  mocks.find.mockResolvedValue({ id: "order1", redeemCodeId: "code1", status: "TRANSFER_FAILED", msisdn: "1234567890", ...previous });
  await expect(transferOrder("order1", replacement)).resolves.toMatchObject({ status: "COMPLETED" });
  expect(mocks.transfer).toHaveBeenCalledWith({ msisdn: "1234567890", ...expected });
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    recipientEmail: expected.recipientEmail ?? null,
    recipientAccountId: expected.recipientAccountId ?? null,
  }) }));
});
