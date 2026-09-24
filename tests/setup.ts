/**
 * 测试全局 setup:
 * - 解析 .env 注入测试环境变量 (DATABASE_URL 指向测试库)
 * - 提供数据库清理/构造助手
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

// ---- 环境变量 ----
function loadEnvFile() {
  try {
    const content = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2];
      }
    }
  } catch {
    // .env 不存在时使用默认值
  }
}
loadEnvFile();

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://esimgg:esimgg_dev@127.0.0.1:5433/esimgg_test?schema=public";
process.env.APP_ENCRYPTION_KEY =
  process.env.APP_ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-session-secret-0123456789abcdef";
process.env.APP_URL = process.env.APP_URL ?? "http://localhost:3100";
export const prisma = new PrismaClient();

const TABLES = [
  '"Order"',
  '"EsimApiKey"',
  '"NumberSearchSession"',
  '"RedeemCode"',
  '"AuditLog"',
  '"Admin"',
  '"SystemSetting"',
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
}

/** 构造系统设置 (默认: 免费模式, initial_balance=0.05) */
export async function seedSettings(
  overrides: Record<string, unknown> = {},
) {
  return prisma.systemSetting.upsert({
    where: { id: 1 },
    update: overrides,
    create: { id: 1, ...overrides },
  });
}

/** 直接构造卡密 */
export async function createCode(
  overrides: Record<string, unknown> = {},
) {
  const { randomBytes } = await import("node:crypto");
  const code =
    (overrides.code as string) ??
    `T${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4)
      .toString("hex")
      .toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  return prisma.redeemCode.create({
    data: { ...overrides, code },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
