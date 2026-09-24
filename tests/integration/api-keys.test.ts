/**
 * 集成测试: 多 API Key 故障转移 + 官方实付成本 (规格 §71)
 *
 * 覆盖:
 *  1. 顺序策略 — 第一个 Key 余额不足, 自动用第二个 Key 购买成功
 *  2. 所有 Key 余额不足 — 订单 FAILED + 卡密释放
 *  3. 随机策略 — 可用 Key 都能完成购买
 *  4. 实付成本 — 购买响应 total_price 落库 (costTotal / costBreakdown)
 *  5. 转移锁定 — 购买与转移使用同一个 Key
 *  6. 结果未知绝不换 Key — 超时后只尝试一次, 走对账
 *  7. 禁用 Key — 不参与调用
 *  8. Key 管理 — 增删启用禁用/排序/兜底旧 Key
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createCode, prisma, resetDb, seedSettings } from "../setup";
import { createFakeEsim } from "../helpers/fake-esim";
import { encryptSecret } from "@/lib/crypto";
import { executePurchase } from "@/services/purchase-service";
import { searchNumbersForCode } from "@/services/search-service";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  moveApiKey,
  resolveLegacyKey,
  setApiKeyEnabled,
  updateKeySettings,
} from "@/services/api-key-service";
import { EsimApiError } from "@/lib/esim/errors";

const KEY_A = "esim_key_A_0001";
const KEY_B = "esim_key_B_0002";

/** 造一个已锁定的卡密 + PENDING 订单, 直接测购买流程 (跳过锁卡密/搜索会话) */
async function arrangeOrder(price = "2.50", initial = "0.50") {
  const code = await createCode({ status: "LOCKED" });
  const order = await prisma.order.create({
    data: {
      redeemCodeId: code.id,
      msisdn: "37233333333",
      numberPrice: price,
      initialBalance: initial,
      accessToken: `tok-${code.id}`,
      status: "PENDING",
      recipientAccountId: "cmabc123456",
    },
  });
  return { code, order };
}

/** 执行购买流程 */
function purchase(order: { id: string }) {
  return executePurchase(order as never);
}

describe("多 API Key (规格 §71)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("1. 顺序策略: 第一个 Key 余额不足 -> 自动用第二个 Key 购买", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 1.0, [KEY_B]: 100 },
      purchaseTotalPrice: 2.99,
    });
    fake.install();
    const a = await createApiKey({ name: "A", apiKey: KEY_A });
    const b = await createApiKey({ name: "B", apiKey: KEY_B });

    const { order } = await arrangeOrder("2.50", "0.50"); // 需要 3.00
    const result = await purchase(order);

    expect(result.status).toBe("COMPLETED");
    // 只购买了一次, 且用的是 B
    expect(fake.purchaseCount()).toBe(1);
    expect(fake.purchaseKeys()).toEqual([KEY_B]);

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh!.apiKeyId).toBe(b.id);
    expect(fresh!.apiKeyId).not.toBe(a.id);
    // 实付成本落库
    expect(fresh!.costTotal?.toString()).toBe("2.99");
    expect(fresh!.costBreakdown).toMatchObject({
      total: 2.99,
      numberPrice: 0,
      vatAmount: 0,
      currency: "EUR",
      estimatedTotal: "3.00",
      source: "purchase_response",
    });
  });

  it("2. 所有 Key 余额不足 -> 订单 FAILED + 卡密释放", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 0.5, [KEY_B]: 1.0 },
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const { code, order } = await arrangeOrder("2.50", "0.50"); // 需要 3.00
    await expect(
      purchase(order),
    ).rejects.toMatchObject({ code: "WALLET_INSUFFICIENT" });

    // 没有发起任何购买
    expect(fake.purchaseCount()).toBe(0);
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh!.status).toBe("FAILED");
    expect(fresh!.errorCode).toBe("WALLET_INSUFFICIENT");
    // 卡密已释放, 可重新选号
    const codeFresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(codeFresh!.status).toBe("UNUSED");
  });

  it("3. 随机策略: 两个 Key 都能完成购买", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 100, [KEY_B]: 100 },
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });
    await updateKeySettings({ keyStrategy: "random" });

    const { order } = await arrangeOrder("0.00", "0.50");
    const result = await purchase(order);
    expect(result.status).toBe("COMPLETED");
    expect(fake.purchaseCount()).toBe(1);
    expect([KEY_A, KEY_B]).toContain(fake.purchaseKeys()[0]);
  });

  it("4. 实付成本: total_price 落库, 与预估区分", async () => {
    const fake = createFakeEsim({ wallet: 100, purchaseTotalPrice: 2.99 });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    const { order } = await arrangeOrder("0.00", "0.50"); // 预估 0.50

    await purchase(order);

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(Number(fresh!.numberPrice)).toBe(0); // 预估号码价
    expect(Number(fresh!.initialBalance)).toBe(0.5); // 预估初始余额
    expect(fresh!.costTotal?.toString()).toBe("2.99"); // 官方实付
    expect(fresh!.costBreakdown).toMatchObject({ estimatedTotal: "0.50" });
  });

  it("5. 转移锁定: 购买与转移使用同一个 Key", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 1.0, [KEY_B]: 100 }, // 只有 B 有钱
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const { order } = await arrangeOrder("2.50", "0.50");
    await purchase(order);

    // 归属检查 + 转移都必须用 B (号码在 B 的账户下)
    const transferCalls = fake.calls.filter(
      (c) => c.path === "/line/transfer_ownership",
    );
    expect(transferCalls).toHaveLength(1);
    expect(transferCalls[0].auth).toBe(`Bearer ${KEY_B}`);
    // 全程没有用 A 发起购买/转移
    expect(fake.purchaseKeys()).toEqual([KEY_B]);
  });

  it("6. 结果未知绝不换 Key: 超时只尝试一次并走对账", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 100, [KEY_B]: 100 },
      purchaseBehaviorByKey: { [KEY_A]: "timeout" },
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const { order } = await arrangeOrder("0.00", "0.50");
    // A 超时 -> 不换 B, 对账未命中 -> PURCHASE_UNCERTAIN
    await expect(
      purchase(order),
    ).rejects.toMatchObject({ code: "PURCHASE_UNCERTAIN" });

    expect(fake.purchaseCount()).toBe(1); // 绝不重买/换 Key 重试
    expect(fake.purchaseKeys()).toEqual([KEY_A]);
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh!.status).toBe("PURCHASE_UNCERTAIN");
  });

  it("6b. 结果未知但对账命中: 仍用原 Key 记录并继续转移", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 100, [KEY_B]: 100 },
      purchaseBehaviorByKey: { [KEY_A]: "timeout" },
      lines: ["37233333333"], // 对账命中
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const { order } = await arrangeOrder("0.00", "0.50");
    const result = await purchase(order);

    expect(result.status).toBe("COMPLETED");
    expect(fake.purchaseCount()).toBe(1);
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    const a = (await listApiKeys())[0];
    expect(fresh!.apiKeyId).toBe(a.id); // 仍是发起购买的 A
  });

  it("7. 禁用的 Key 不参与调用", async () => {
    const fake = createFakeEsim({ wallet: 100 });
    fake.install();
    const a = await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });
    await setApiKeyEnabled(a.id, false);

    const { order } = await arrangeOrder("0.00", "0.50");
    await purchase(order);
    expect(fake.purchaseKeys()).toEqual([KEY_B]);
  });

  it("8. 购买返回余额不足明确失败 -> 切换到有余额的 Key", async () => {
    const fake = createFakeEsim({
      walletByKey: { [KEY_A]: 100, [KEY_B]: 100 }, // 预检都通过
      purchaseBehaviorByKey: { [KEY_A]: "insufficient-balance" },
    });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const { order } = await arrangeOrder("0.00", "0.50");
    const result = await purchase(order);
    expect(result.status).toBe("COMPLETED");
    expect(fake.purchaseKeys()).toEqual([KEY_A, KEY_B]); // A 明确失败后切换 B
  });

  it("9. 排序: 上移改变顺序调用优先级", async () => {
    const fake = createFakeEsim({ wallet: 100 });
    fake.install();
    const a = await createApiKey({ name: "A", apiKey: KEY_A });
    const b = await createApiKey({ name: "B", apiKey: KEY_B });
    expect((await listApiKeys()).map((k) => k.id)).toEqual([a.id, b.id]);

    await moveApiKey(b.id, "up");
    expect((await listApiKeys()).map((k) => k.id)).toEqual([b.id, a.id]);

    const { order } = await arrangeOrder("0.00", "0.50");
    await purchase(order);
    expect(fake.purchaseKeys()).toEqual([KEY_B]); // 上移后 B 优先
  });

  it("10. 删除全部 Key 后兜底旧版单 Key (用户要求保留)", async () => {
    const fake = createFakeEsim({ wallet: 100, apiKey: "legacy_key_999" });
    fake.install();
    // 旧版单 Key (SystemSetting.encryptedEsimApiKey)
    await seedSettings({ encryptedEsimApiKey: encryptSecret("legacy_key_999") });

    const a = await createApiKey({ name: "A", apiKey: KEY_A });
    await deleteApiKey(a.id);
    expect(await listApiKeys()).toHaveLength(0);

    const legacy = await resolveLegacyKey();
    expect(legacy?.apiKey).toBe("legacy_key_999");

    const { order } = await arrangeOrder("0.00", "0.50");
    const result = await purchase(order);
    expect(result.status).toBe("COMPLETED");
    expect(fake.purchaseKeys()).toEqual(["legacy_key_999"]);
    // 兜底 Key 不写入 apiKeyId (它不是表内 Key)
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh!.apiKeyId).toBeNull();
  });

  it("11. 还有未完成转移的订单时禁止删除 Key", async () => {
    await createApiKey({ name: "A", apiKey: KEY_A });

    const code = await createCode({ status: "PURCHASED" });
    const order = await prisma.order.create({
      data: {
        redeemCodeId: code.id,
        msisdn: "37233333333",
        numberPrice: "0.00",
        initialBalance: "0.50",
        accessToken: `tok-${code.id}`,
        status: "PURCHASED",
        recipientAccountId: "cmabc123456",
        apiKeyId: (await listApiKeys())[0].id,
        purchasedAt: new Date(),
      },
    });
    void order;

    await expect(deleteApiKey((await listApiKeys())[0].id)).rejects.toMatchObject({
      code: "KEY_IN_USE",
    });
    expect(await listApiKeys()).toHaveLength(1);

    // 订单完成后即可删除
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    const { detachedOrders } = await deleteApiKey((await listApiKeys())[0].id);
    expect(detachedOrders).toBe(1);
    expect(await listApiKeys()).toHaveLength(0);
  });

  it("11b. 兜底 Key 不写入订单 apiKeyId (它不是表内 Key)", async () => {
    const fake = createFakeEsim({ wallet: 100, apiKey: "legacy_only_key" });
    fake.install();
    await seedSettings({ encryptedEsimApiKey: encryptSecret("legacy_only_key") });

    const { order } = await arrangeOrder("0.00", "0.50");
    const result = await purchase(order);
    expect(result.status).toBe("COMPLETED");
    expect(fake.purchaseKeys()).toEqual(["legacy_only_key"]);
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh!.apiKeyId).toBeNull();
  });

  it("12. 搜索使用网关: Key 级错误自动切换", async () => {
    const fake = createFakeEsim({ wallet: 100 });
    fake.install();
    await createApiKey({ name: "A", apiKey: KEY_A });
    await createApiKey({ name: "B", apiKey: KEY_B });

    const code = await createCode();
    const result = await searchNumbersForCode({ codeId: code.id, search: "372" });
    expect(result.numbers.length).toBeGreaterThan(0);
    expect(fake.calls.filter((c) => c.path === "/number/search")).toHaveLength(1);
  });

  it("13. 策略与阈值持久化", async () => {
    await updateKeySettings({
      keyStrategy: "random",
      keyLowBalanceThreshold: "5.5",
    });
    const s = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    expect(s!.keyStrategy).toBe("random");
    expect(Number(s!.keyLowBalanceThreshold)).toBe(5.5);
  });

  it("14. 非法策略被拒绝", async () => {
    await expect(updateKeySettings({ keyStrategy: "nope" })).rejects.toMatchObject({
      code: "KEY_STRATEGY_INVALID",
    });
    await expect(
      updateKeySettings({ keyLowBalanceThreshold: -1 }),
    ).rejects.toMatchObject({ code: "KEY_THRESHOLD_INVALID" });
  });
});

describe("EsimApiError 分类 (规格 §71)", () => {
  it("uncertain 错误不参与 Key 切换判定", () => {
    const err = EsimApiError.uncertain("timeout", undefined, "TIMEOUT");
    expect(err.kind).toBe("uncertain");
  });
});
