/**
 * 首次启动种子脚本 (规格 §54)
 * - 若数据库中没有管理员, 从 ADMIN_INITIAL_USERNAME / ADMIN_INITIAL_PASSWORD 创建
 * - 确保 SystemSetting 单例存在
 * 运行: npm run seed  (或 prisma db seed)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const adminCount = await prisma.admin.count();
  let createdPassword: string | null = null;

  if (adminCount === 0) {
    const username = (process.env.ADMIN_INITIAL_USERNAME || "admin").trim();
    let password = process.env.ADMIN_INITIAL_PASSWORD || "";

    if (password && password.length < 8) {
      throw new Error("ADMIN_INITIAL_PASSWORD 至少需要 8 位");
    }
    if (!password) {
      // 未提供初始密码时生成随机密码并打印一次 (生产环境应显式设置)
      password = randomBytes(12).toString("base64url");
      createdPassword = password;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`[seed] 已创建管理员: ${username}`);
    if (createdPassword) {
      console.log(`[seed] 生成的随机管理员密码 (仅显示一次): ${createdPassword}`);
      console.log("[seed] 请立即登录后台修改密码。");
    }
  } else {
    console.log(`[seed] 已存在 ${adminCount} 个管理员, 跳过创建`);
  }

  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log("[seed] SystemSetting 单例就绪");
}

main()
  .catch((e) => {
    console.error("[seed] 失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
