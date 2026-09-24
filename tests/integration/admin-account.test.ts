/**
 * 集成测试: 管理员账号自管理 (规格 §70)
 */
import { describe, expect, it, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma, resetDb } from "../setup";
import { updateOwnAccount } from "@/services/admin-service";

const PASSWORD = "current-pass-123";

async function createAdmin(username = "admin", password = PASSWORD) {
  return prisma.admin.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function hashOf(adminId: string): Promise<string> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  return admin!.passwordHash;
}

describe("admin-service 账号自管理 (规格 §70)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("修改密码成功 (哈希已更新, 旧密码失效)", async () => {
    const admin = await createAdmin();
    const result = await updateOwnAccount({
      adminId: admin.id,
      currentPassword: PASSWORD,
      newPassword: "new-pass-456",
    });
    expect(result.passwordChanged).toBe(true);
    expect(result.usernameChanged).toBe(false);
    expect(result.username).toBe("admin");
    const hash = await hashOf(admin.id);
    expect(await bcrypt.compare("new-pass-456", hash)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, hash)).toBe(false);
  });

  it("修改用户名成功 (密码不受影响)", async () => {
    const admin = await createAdmin();
    const result = await updateOwnAccount({
      adminId: admin.id,
      currentPassword: PASSWORD,
      newUsername: "  ops-01  ",
    });
    expect(result.usernameChanged).toBe(true);
    expect(result.passwordChanged).toBe(false);
    expect(result.username).toBe("ops-01");
    expect(await bcrypt.compare(PASSWORD, await hashOf(admin.id))).toBe(true);
  });

  it("同时修改用户名与密码 (原子更新)", async () => {
    const admin = await createAdmin();
    const result = await updateOwnAccount({
      adminId: admin.id,
      currentPassword: PASSWORD,
      newUsername: "ops-02",
      newPassword: "new-pass-456",
    });
    expect(result).toMatchObject({
      username: "ops-02",
      usernameChanged: true,
      passwordChanged: true,
    });
    const fresh = await prisma.admin.findUnique({ where: { id: admin.id } });
    expect(fresh!.username).toBe("ops-02");
    expect(await bcrypt.compare("new-pass-456", fresh!.passwordHash)).toBe(true);
  });

  it("当前密码错误 -> 401 CURRENT_PASSWORD_INVALID, 且不做任何修改", async () => {
    const admin = await createAdmin();
    const before = await hashOf(admin.id);
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: "wrong-pass",
        newPassword: "new-pass-456",
      }),
    ).rejects.toMatchObject({ status: 401, code: "CURRENT_PASSWORD_INVALID" });
    expect(await hashOf(admin.id)).toBe(before);
    expect((await prisma.admin.findUnique({ where: { id: admin.id } }))!.username).toBe(
      "admin",
    );
  });

  it("当前密码为空 -> 拒绝", async () => {
    const admin = await createAdmin();
    await expect(
      updateOwnAccount({ adminId: admin.id, currentPassword: "", newUsername: "ops-03" }),
    ).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INVALID" });
  });

  it("新用户名已被占用 -> USERNAME_TAKEN, 且不泄露他人账号", async () => {
    const admin = await createAdmin("admin");
    await createAdmin("taken-name");
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: PASSWORD,
        newUsername: "taken-name",
      }),
    ).rejects.toMatchObject({ status: 400, code: "USERNAME_TAKEN" });
    expect((await prisma.admin.findUnique({ where: { id: admin.id } }))!.username).toBe(
      "admin",
    );
  });

  it("新用户名与当前相同 -> USERNAME_UNCHANGED", async () => {
    const admin = await createAdmin();
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: PASSWORD,
        newUsername: "admin",
      }),
    ).rejects.toMatchObject({ code: "USERNAME_UNCHANGED" });
  });

  it("用户名格式非法 (过短/含中文/含空白) -> USERNAME_INVALID", async () => {
    const admin = await createAdmin();
    for (const bad of ["ab", "中文名", "has space", "a".repeat(33), "name!"]) {
      await expect(
        updateOwnAccount({
          adminId: admin.id,
          currentPassword: PASSWORD,
          newUsername: bad,
        }),
      ).rejects.toMatchObject({ code: "USERNAME_INVALID" });
    }
  });

  it("新密码与当前相同 -> PASSWORD_UNCHANGED", async () => {
    const admin = await createAdmin();
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: PASSWORD,
        newPassword: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_UNCHANGED" });
  });

  it("新密码过短或超长 -> PASSWORD_INVALID", async () => {
    const admin = await createAdmin();
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: PASSWORD,
        newPassword: "short",
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_INVALID" });
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: PASSWORD,
        newPassword: "x".repeat(73),
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_INVALID" });
  });

  it("格式校验先于当前密码校验 (不消耗密码尝试次数)", async () => {
    const admin = await createAdmin();
    await expect(
      updateOwnAccount({
        adminId: admin.id,
        currentPassword: "wrong-pass",
        newUsername: "ab",
      }),
    ).rejects.toMatchObject({ code: "USERNAME_INVALID" });
  });

  it("管理员不存在 -> 401", async () => {
    await expect(
      updateOwnAccount({
        adminId: "not-exist",
        currentPassword: PASSWORD,
        newPassword: "new-pass-456",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("未提供任何修改项 -> 不修改任何字段", async () => {
    const admin = await createAdmin();
    const result = await updateOwnAccount({
      adminId: admin.id,
      currentPassword: PASSWORD,
    });
    expect(result).toMatchObject({
      username: "admin",
      usernameChanged: false,
      passwordChanged: false,
    });
    expect(await bcrypt.compare(PASSWORD, await hashOf(admin.id))).toBe(true);
  });

  it("updatedAt 随变更刷新", async () => {
    const admin = await createAdmin();
    await new Promise((r) => setTimeout(r, 20));
    await updateOwnAccount({
      adminId: admin.id,
      currentPassword: PASSWORD,
      newPassword: "new-pass-456",
    });
    const fresh = await prisma.admin.findUnique({ where: { id: admin.id } });
    expect(fresh!.updatedAt.getTime()).toBeGreaterThan(admin.updatedAt.getTime());
  });
});
