import { beforeEach, expect, it, vi } from 'vitest';
import type { Order } from '@prisma/client';
const mocks = vi.hoisted(() => ({ session: vi.fn(), start: vi.fn(), active: vi.fn() }));
vi.mock('@/lib/redeem-session', () => ({ getRedeemSession: mocks.session }));
vi.mock('@/services/purchase-service', () => ({ startRedemption: mocks.start }));
vi.mock('@/services/redeem-service', () => ({ latestActiveOrder: mocks.active }));
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
import { POST } from '@/app/api/orders/route';
import { ApiError } from '@/lib/http';
import { serializeOrder } from '@/lib/serialize';
const order = {
  accessToken: 'private-status-link', msisdn: '372555555', numberPrice: '0', initialBalance: '0.50',
  recipientEmail: 'user@example.com', recipientAccountId: null, status: 'TRANSFER_FAILED',
  errorCode: 'recipient_not_found', errorMessage: 'recipient not found; internal account context',
  createdAt: new Date(), purchasedAt: new Date(), completedAt: null,
} as unknown as Order;
const request = () => new Request('https://example.test/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msisdn: order.msisdn, email: order.recipientEmail }) });
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ codeId: 'current-code' }); });
it.each([
  ['TRANSFER_RECIPIENT_INVALID', 502, 'TRANSFER_FAILED'],
  ['PURCHASE_UNCERTAIN', 409, 'PURCHASE_UNCERTAIN'],
  ['CODE_NOT_AVAILABLE', 409, 'PURCHASED'],
])('returns the committed order link after %s so checkout can recover', async (code, status, orderStatus) => {
  mocks.start.mockRejectedValue(new ApiError(status, code, '操作未完成'));
  mocks.active.mockResolvedValue({ ...order, status: orderStatus });
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: code, order: { token: order.accessToken, status: orderStatus } });
  expect(mocks.active).toHaveBeenCalledWith('current-code');
});
it('does not invent an order link when purchase failed before commitment', async () => {
  mocks.start.mockRejectedValue(new ApiError(409, 'NUMBER_UNAVAILABLE', '重新选号'));
  mocks.active.mockResolvedValue(null);
  const response = await POST(request());
  expect(await response.json()).toEqual({ error: 'NUMBER_UNAVAILABLE', message: '重新选号' });
});
it('requires the redemption session before looking up an order', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.active).not.toHaveBeenCalled();
});
it('shows a useful recipient failure without exposing the raw upstream error', () => {
  const publicOrder = serializeOrder(order);
  expect(publicOrder.errorMessage).toContain('UserID 或邮箱');
  expect(publicOrder.errorMessage).not.toContain('internal account context');
  expect(publicOrder.errorCode).toBe('TRANSFER_RECIPIENT_INVALID');
});
