/**
 * 集成测试: 卡密服务 + 验证服务 + 审计 (规格 §14-§21/§38)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createCode, prisma, resetDb, seedSettings } from "../setup";
import {
  generateCodes,
  listCodes,
  setCodeStatus,
  deleteUnusedCode,
  exportCodes,
} from "@/services/code-service";
import { verifyCode, normalizeCode } from "@/services/redeem-service";
import { writeAudit, listAudit } from "@/services/audit-service";

describe("code-service (规格 §14-§18)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("批量生成: 数量/格式/唯一性 (规格 §15)", async () => {
    const codes = await generateCodes({ count: 50, prefix: "ESIM" });
    expect(codes).toHaveLength(50);
    const unique = new Set(codes.map((c) => c.code));
    expect(unique.size).toBe(50);
    for (const c of codes) {
      expect(c.code).toMatch(/^ESIM-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c.status).toBe("UNUSED");
    }
  });

  it("不使用易混淆字符 (I/O/0/1)", async () => {
    const codes = await generateCodes({ count: 100, prefix: "" });
    for (const c of codes) {
      expect(c.code).not.toMatch(/[IO01]/);
    }
  });

  it("数量/前缀校验", async () => {
    await expect(generateCodes({ count: 0 })).rejects.toMatchObject({ code: "COUNT_INVALID" });
    await expect(generateCodes({ count: 5000 })).rejects.toMatchObject({ code: "COUNT_INVALID" });
    await expect(generateCodes({ count: 1, prefix: "esim!" })).rejects.toMatchObject({
      code: "PREFIX_INVALID",
    });
  });

  it("有效期: 永久 / 指定天数", async () => {
    const permanent = await generateCodes({ count: 1 });
    expect(permanent[0].expiresAt).toBeNull();
    const limited = await generateCodes({ count: 1, expiresInDays: 30 });
    expect(limited[0].expiresAt).not.toBeNull();
    expect(limited[0].expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("禁用/启用/删除 状态流转 (规格 §14)", async () => {
    const [code] = await generateCodes({ count: 1 });
    await setCodeStatus(code.id, "DISABLED");
    expect((await prisma.redeemCode.findUnique({ where: { id: code.id } }))!.status).toBe(
      "DISABLED",
    );
    await setCodeStatus(code.id, "UNUSED");
    expect((await prisma.redeemCode.findUnique({ where: { id: code.id } }))!.status).toBe(
      "UNUSED",
    );
    await deleteUnusedCode(code.id);
    expect(await prisma.redeemCode.findUnique({ where: { id: code.id } })).toBeNull();
  });

  it("已使用卡密不能禁用/删除", async () => {
    const code = await createCode({ status: "USED" });
    await expect(setCodeStatus(code.id, "DISABLED")).rejects.toMatchObject({
      code: "CODE_USED",
    });
    await expect(deleteUnusedCode(code.id)).rejects.toMatchObject({
      code: "CODE_NOT_UNUSED",
    });
  });

  it("非 UNUSED 卡密不能删除", async () => {
    const code = await createCode({ status: "LOCKED" });
    await expect(deleteUnusedCode(code.id)).rejects.toMatchObject({
      code: "CODE_NOT_UNUSED",
    });
  });

  it("列表: 状态过滤 + 搜索 + 分页", async () => {
    await generateCodes({ count: 25, prefix: "AAA" });
    await generateCodes({ count: 5, prefix: "BBB" });
    const page1 = await listCodes({ page: 1, pageSize: 20 });
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(30);
    const page2 = await listCodes({ page: 2, pageSize: 20 });
    expect(page2.items).toHaveLength(10);
    const filtered = await listCodes({ search: "BBB" });
    expect(filtered.total).toBe(5);
    const disabled = await listCodes({ status: "UNUSED" });
    expect(disabled.total).toBe(30);
  });

  it("导出 TXT / CSV (规格 §14)", async () => {
    await generateCodes({ count: 3, prefix: "ESIM", remark: "第一批" });
    const txt = await exportCodes({ format: "txt" });
    expect(txt.contentType).toContain("text/plain");
    const lines = txt.body.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.startsWith("ESIM-"))).toBe(true);

    const csv = await exportCodes({ format: "csv" });
    expect(csv.contentType).toContain("text/csv");
    const rows = csv.body.trim().split("\n");
    expect(rows).toHaveLength(4); // header + 3
    expect(rows[0]).toBe("code,status,batch_id,remark,expires_at,created_at");
    expect(rows[1]).toContain("第一批");
  });
});

describe("redeem-service verify (规格 §20-§21)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("UNUSED -> READY", async () => {
    const code = await createCode();
    const result = await verifyCode(code.code);
    expect(result.kind).toBe("READY");
    expect(result.codeId).toBe(code.id);
  });

  it("卡密不存在 -> 404", async () => {
    await expect(verifyCode("NOPE-AAAA-BBBB-CCCC")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("DISABLED -> 403", async () => {
    const code = await createCode({ status: "DISABLED" });
    await expect(verifyCode(code.code)).rejects.toMatchObject({ status: 403 });
  });

  it("过期 -> 403", async () => {
    const code = await createCode({ expiresAt: new Date(Date.now() - 1000) });
    await expect(verifyCode(code.code)).rejects.toMatchObject({ status: 403 });
  });

  it("PURCHASED -> RESUME 并可重试转移 (规格 §21)", async () => {
    const code = await createCode({ status: "PURCHASED" });
    await prisma.order.create({
      data: {
        redeemCodeId: code.id,
        msisdn: "37211111111",
        numberPrice: 0,
        initialBalance: 0.05,
        accessToken: "tok_purchased",
        status: "TRANSFER_FAILED",
        recipientEmail: "wrong@example.com",
      },
    });
    const result = await verifyCode(code.code);
    expect(result.kind).toBe("RESUME");
    if (result.kind === "RESUME") {
      expect(result.canRetryTransfer).toBe(true);
      expect(result.order.token).toBe("tok_purchased");
      expect(result.order.status).toBe("TRANSFER_FAILED");
    }
  });

  it("USED -> COMPLETED (只读)", async () => {
    const code = await createCode({ status: "USED", usedAt: new Date() });
    await prisma.order.create({
      data: {
        redeemCodeId: code.id,
        msisdn: "37211111111",
        numberPrice: 0,
        initialBalance: 0.05,
        accessToken: "tok_used",
        status: "COMPLETED",
        recipientEmail: "user@example.com",
        completedAt: new Date(),
      },
    });
    const result = await verifyCode(code.code);
    expect(result.kind).toBe("COMPLETED");
  });

  it("normalizeCode: 去空白大写", () => {
    expect(normalizeCode("  esim-abcd-1111-2222 ")).toBe("ESIM-ABCD-1111-2222");
    expect(normalizeCode(null)).toBe("");
  });

  it("陈旧 LOCKED (无订单, 超过 30 分钟) 自动释放", async () => {
    const code = await createCode({
      status: "LOCKED",
      lockedAt: new Date(Date.now() - 40 * 60 * 1000),
    });
    const result = await verifyCode(code.code);
    expect(result.kind).toBe("READY");
    const fresh = await prisma.redeemCode.findUnique({ where: { id: code.id } });
    expect(fresh?.status).toBe("UNUSED");
  });
});

describe("audit-service (规格 §38)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("写入与查询", async () => {
    await writeAudit({
      adminId: "admin-1",
      action: "API_KEY_UPDATE",
      targetType: "system_setting",
      targetId: "1",
      metadata: { apiKey: "esim_****1234" },
      ip: "1.2.3.4",
    });
    await writeAudit({ action: "CODES_GENERATE", metadata: { count: 10 } });
    const page = await listAudit({ page: 1, pageSize: 10 });
    expect(page.total).toBe(2);
    expect(page.items[0].action).toBe("CODES_GENERATE"); // 最新在前
    const filtered = await listAudit({ action: "API_KEY_UPDATE" });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].ip).toBe("1.2.3.4");
  });
});
