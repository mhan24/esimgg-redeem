/**
 * 集成测试: 购买/转移状态机 (规格 §62 必测项 + 原则 1-10)
 *
 * 覆盖:
 *  1. 卡密并发 — 两个请求同时使用同一卡密, 只有一个成功进入购买
 *  2. 免费号码保护 — 付费号码必须被拒绝
 *  3. 最高价格 — price > max_paid_number_price 必须拒绝
 *  4. Purchase Timeout — 对账命中后继续 Transfer, 不重复购买
 *  5. Purchase Timeout 未命中 — PURCHASE_UNCERTAIN, 卡密保持 LOCKED
 *  6. Transfer Failure — 卡密不能重新选号/重新购买
 *  7. Transfer Retry — 修改邮箱后成功 -> COMPLETED / USED
 *  8. API Key — 任何响应/日志不包含 API Key
 *  9. 明确失败 — 释放卡密 LOCKED -> UNUSED, 可重新选号
 * 10. Search Session 过期 — 拒绝下单
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  createCode,
  prisma,
  resetDb,
  seedSettings,
} from "../setup";
import { createFakeEsim, type FakeEsim } from "../helpers/fake-esim";
import { encryptSecret } from "@/lib/crypto";
import { startRedemption } from "@/services/purchase-service";
import { transferOrder } from "@/services/transfer-service";
import { searchNumbersForCode } from "@/services/search-service";
import { serializeOrder } from "@/lib/serialize";

const FREE_LINES = [
  { msisdn: "37211111111", price: 0 },
  { msisdn: "37222222222", price: 0 },
];
const PAID_LINE = { msisdn: "37233333333", price: 3 };

/** 安装 fake esim 并把 Key 写入设置 */
async function arrange(fake: FakeEsim, settings: Record<string, unknown> = {}) {
  fake.install();
  await seedSettings({
    encryptedEsimApiKey: encryptSecret(fake.apiKey),
    ...settings,
  });
}

/** 为卡密执行一次搜索, 建立 SearchSession */
async function doSearch(codeId: string, fake: FakeEsim, search = "372") {
  return searchNumbersForCode({ codeId, search });
}

describe("购买/转移状态机 (规格 §62)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("1. 卡密并发: 同一卡密同时购买只有一个成功", async () => {
    const fake = createFakeEsim();
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    const results = await Promise.allSettled([
      startRedemption({
        codeId: code.id,
        msisdn: "37211111111",
        recipientAccountId: "cmabc123456",
      }),
      startRedemption({
        codeId: code.id,
        msisdn: "37222222222",
        recipientAccountId: "cmdef789012",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // 只购买了一个号码
    expect(fake.purchaseCount()).toBe(1);
    // 只创建了一个订单
    const orders = await prisma.order.findMany({ where: { redeemCodeId: code.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("COMPLETED");
    // 卡密 -> USED
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("USED");
  });

  it("2. 免费号码保护: allow_paid=false 时付费号码被拒绝", async () => {
    const fake = createFakeEsim({
      searchResults: [...FREE_LINES, PAID_LINE],
    });
    await arrange(fake, { allowPaidNumbers: false, allowFreeNumbers: true });
    const code = await createCode();

    // 搜索: 服务端必须过滤掉付费号码 (规格 §8)
    const { numbers } = await doSearch(code.id, fake);
    expect(numbers.map((n) => n.msisdn)).not.toContain(PAID_LINE.msisdn);
    expect(numbers.every((n) => n.price === 0)).toBe(true);

    // 直接构造付费会话后下单: 必须拒绝 (规格 §25)
    const { randomBytes } = await import("node:crypto");
    await prisma.numberSearchSession.create({
      data: {
        redeemCodeId: code.id,
        sessionToken: randomBytes(16).toString("base64url"),
        msisdn: PAID_LINE.msisdn,
        price: PAID_LINE.price,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    const err = await startRedemption({
      codeId: code.id,
      msisdn: PAID_LINE.msisdn,
      recipientAccountId: "cmabc123456",
    }).catch((e) => e);
    expect(err.code).toBe("PAID_NOT_ALLOWED");
    expect(fake.purchaseCount()).toBe(0);

    // 卡密未被消耗 (事务回滚)
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");
  });

  it("3. 最高价格: price > max_paid_number_price 被拒绝", async () => {
    const fake = createFakeEsim({
      searchResults: [{ msisdn: "37233333333", price: 3 }],
    });
    await arrange(fake, {
      allowFreeNumbers: true,
      allowPaidNumbers: true,
      maxPaidNumberPrice: "2.00",
    });
    const code = await createCode();

    // 搜索阶段已被过滤 (规格 §9)
    const { numbers } = await doSearch(code.id, fake);
    expect(numbers).toHaveLength(0);

    // 构造超价会话后下单: 必须拒绝
    const { randomBytes } = await import("node:crypto");
    await prisma.numberSearchSession.create({
      data: {
        redeemCodeId: code.id,
        sessionToken: randomBytes(16).toString("base64url"),
        msisdn: "37233333333",
        price: 3,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37233333333",
      recipientAccountId: "cmabc123456",
    }).catch((e) => e);
    expect(err.code).toBe("PRICE_TOO_HIGH");
    expect(fake.purchaseCount()).toBe(0);
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");
  });

  it("4. Purchase Timeout: 对账命中 -> 继续 Transfer, 绝不重复购买 (原则 4)", async () => {
    const fake = createFakeEsim({ purchaseBehavior: "timeout" });
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    // 模拟: 购买请求超时, 但号码实际已购买成功 (在平台账户中)
    fake.lines.push("37211111111");

    const order = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    });

    expect(order.status).toBe("COMPLETED");
    // 绝不重复购买
    expect(fake.purchaseCount()).toBe(1);
    // 确实调用了对账
    expect(fake.calls.some((c) => c.path === "/line/all")).toBe(true);
    // 转移成功: 号码已移出平台账户
    expect(fake.lines).not.toContain("37211111111");
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("USED");
  });

  it("5. Purchase Timeout 未命中: PURCHASE_UNCERTAIN, 卡密保持 LOCKED", async () => {
    const fake = createFakeEsim({ purchaseBehavior: "network-error" });
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    }).catch((e) => e);

    expect(err.code).toBe("PURCHASE_UNCERTAIN");
    expect(fake.purchaseCount()).toBe(1);

    const order = await prisma.order.findFirst({ where: { redeemCodeId: code.id } });
    expect(order?.status).toBe("PURCHASE_UNCERTAIN");
    // 未确认购买成功前卡密不能回 UNUSED (原则 2)
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("LOCKED");
  });

  it("6. Transfer 失败: 卡密保持 PURCHASED, 不能重新购买 (原则 3)", async () => {
    const fake = createFakeEsim({ transferBehavior: "fail" });
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmwrong9999",
    }).catch((e) => e);

    expect(err.code).toBe("TRANSFER_RECIPIENT_INVALID");
    const order = await prisma.order.findFirst({ where: { redeemCodeId: code.id } });
    expect(order?.status).toBe("TRANSFER_FAILED");
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("PURCHASED");
    // 号码仍在平台账户中, 只购买了一次
    expect(fake.lines).toContain("37211111111");
    expect(fake.purchaseCount()).toBe(1);

    // 不允许用同一卡密重新选号购买 (状态不是 UNUSED, 必然被并发锁拒绝)
    const err2 = await startRedemption({
      codeId: code.id,
      msisdn: "37222222222",
      recipientAccountId: "cmother5555",
    }).catch((e) => e);
    expect(err2.code).toBe("CODE_NOT_AVAILABLE");
    expect(fake.purchaseCount()).toBe(1);
  });

  it("7. Transfer 重试: 修改邮箱后成功 -> COMPLETED / USED (规格 §31)", async () => {
    const fake = createFakeEsim({ transferBehavior: "fail" });
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmwrong9999",
    }).catch(() => undefined);

    const order = await prisma.order.findFirst({ where: { redeemCodeId: code.id } });
    expect(order?.status).toBe("TRANSFER_FAILED");

    // 管理员/用户改用正确邮箱重试
    fake.transferBehavior = "ok";
    const retried = await transferOrder(order!.id, {
      recipientAccountId: "cmright7777",
    });
    expect(retried.status).toBe("COMPLETED");
    expect(retried.recipientAccountId).toBe("cmright7777");
    expect(fake.purchaseCount()).toBe(1); // 绝不重复购买

    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("USED");
  });

  it("8. API Key 不出现在任何用户可见响应中 (原则 8)", async () => {
    const fake = createFakeEsim();
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    const order = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    });

    const serialized = JSON.stringify(serializeOrder(order));
    expect(serialized).not.toContain(fake.apiKey);
    // 序列化结果不包含数据库 ID 与内部响应 (规格 §50)
    const plain = JSON.parse(serialized);
    expect(plain.id).toBeUndefined();
    expect(plain.purchaseResponse).toBeUndefined();
    expect(plain.transferResponse).toBeUndefined();
  });

  it("9. 明确失败: 释放卡密 LOCKED -> UNUSED, 可重新选号 (规格 §18)", async () => {
    const fake = createFakeEsim({ purchaseBehavior: "definitive-fail" });
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    }).catch((e) => e);

    expect(err.code).toBe("NUMBER_UNAVAILABLE");
    const order = await prisma.order.findFirst({ where: { redeemCodeId: code.id } });
    expect(order?.status).toBe("FAILED");
    let fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");

    // 号码可用后可以重新选号完成兑换
    fake.purchaseBehavior = "ok";
    const { resetRateLimits } = await import("@/lib/ratelimit");
    resetRateLimits(); // 跳过 3 秒搜索间隔限制 (规格 §11)
    await doSearch(code.id, fake);
    const order2 = await startRedemption({
      codeId: code.id,
      msisdn: "37222222222",
      recipientAccountId: "cmuser12345",
    });
    expect(order2.status).toBe("COMPLETED");
    fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("USED");
  });

  it("10. Search Session 过期: 拒绝下单 (规格 §13)", async () => {
    const fake = createFakeEsim();
    await arrange(fake);
    const code = await createCode();
    await doSearch(code.id, fake);

    // 手动过期所有会话
    await prisma.numberSearchSession.updateMany({
      where: { redeemCodeId: code.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    }).catch((e) => e);
    expect(err.code).toBe("SEARCH_SESSION_EXPIRED");
    expect(fake.purchaseCount()).toBe(0);
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");
  });

  it("11. 订单快照: 修改设置不影响历史订单 (原则 9)", async () => {
    const fake = createFakeEsim();
    await arrange(fake, { initialBalance: "0.05" });
    const code = await createCode();
    await doSearch(code.id, fake);

    const order = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    });
    expect(order.initialBalance.toString()).toBe("0.05");
    expect(Number(order.numberPrice.toString())).toBe(0);

    // 管理员修改初始余额
    await prisma.systemSetting.update({
      where: { id: 1 },
      data: { initialBalance: "2.00" },
    });
    const reloaded = await prisma.order.findUnique({ where: { id: order.id } });
    expect(reloaded?.initialBalance.toString()).toBe("0.05");
  });

  it("12. Wallet 不足: 拒绝购买并释放卡密 (规格 §41)", async () => {
    const fake = createFakeEsim({ wallet: 0.01 });
    await arrange(fake, { initialBalance: "0.05" });
    const code = await createCode();
    await doSearch(code.id, fake);

    const err = await startRedemption({
      codeId: code.id,
      msisdn: "37211111111",
      recipientAccountId: "cmuser12345",
    }).catch((e) => e);
    expect(err.code).toBe("WALLET_INSUFFICIENT");
    expect(fake.purchaseCount()).toBe(0);
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");
  });
});
