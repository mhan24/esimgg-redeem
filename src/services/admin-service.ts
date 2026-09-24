/**
 * 管理员账号自管理服务 (规格 §70)
 * 修改用户名 / 密码: 必须验证当前密码, 用户名与密码一次性原子更新
 */
import type { Admin } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, badRequest, unauthorized } from "@/lib/http";
import { isValidPassword, isValidUsername } from "@/lib/validate";

/** 与 seed / 登录保持一致的成本因子 */
const BCRYPT_ROUNDS = 10;

/** 当前密码错误 (路由据此累计限流) */
export function currentPasswordInvalid(): ApiError {
  return new ApiError(401, "CURRENT_PASSWORD_INVALID", "当前密码不正确");
}

export async function getAdminById(adminId: string): Promise<Admin | null> {
  return prisma.admin.findUnique({ where: { id: adminId } });
}

export interface UpdateOwnAccountInput {
  adminId: string;
  /** 当前密码 (用户名与密码修改都必须提供) */
  currentPassword: string;
  /** 新用户名; 空字符串/undefined 表示不修改 */
  newUsername?: string;
  /** 新密码; 空字符串/undefined 表示不修改 */
  newPassword?: string;
}

export interface UpdateOwnAccountResult {
  username: string;
  usernameChanged: boolean;
  passwordChanged: boolean;
}

/** 校验当前密码 (恒定时间比较由 bcrypt 保证) */
async function assertCurrentPassword(
  admin: Admin,
  currentPassword: string,
): Promise<void> {
  if (!currentPassword) throw currentPasswordInvalid();
  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) throw currentPasswordInvalid();
}

/**
 * 修改当前管理员的用户名和/或密码。
 * 用户名唯一性冲突 (含并发) 统一转换为 USERNAME_TAKEN。
 */
export async function updateOwnAccount(
  input: UpdateOwnAccountInput,
): Promise<UpdateOwnAccountResult> {
  const admin = await getAdminById(input.adminId);
  if (!admin) throw unauthorized();

  const newUsername = (input.newUsername ?? "").trim();
  const newPassword = input.newPassword ?? "";
  const wantUsername = newUsername.length > 0;
  const wantPassword = newPassword.length > 0;

  // 输入格式先行校验 (不涉及账号信息, 无信息泄露)
  if (wantUsername && !isValidUsername(newUsername)) {
    throw badRequest(
      "USERNAME_INVALID",
      "用户名需为 3-32 位字母、数字、下划线或连字符",
    );
  }
  if (wantPassword && !isValidPassword(newPassword)) {
    throw badRequest("PASSWORD_INVALID", "新密码需为 8-72 位");
  }

  // 当前密码只校验一次 (可能同时改用户名和密码)
  await assertCurrentPassword(admin, input.currentPassword);

  if (wantUsername && newUsername === admin.username) {
    throw badRequest("USERNAME_UNCHANGED", "新用户名不能与当前用户名相同");
  }
  if (wantUsername) {
    const taken = await prisma.admin.findUnique({ where: { username: newUsername } });
    if (taken) throw badRequest("USERNAME_TAKEN", "该用户名已被占用");
  }
  if (wantPassword) {
    const reused = await bcrypt.compare(newPassword, admin.passwordHash);
    if (reused) throw badRequest("PASSWORD_UNCHANGED", "新密码不能与当前密码相同");
  }

  const data: { username?: string; passwordHash?: string } = {};
  if (wantUsername) data.username = newUsername;
  if (wantPassword) data.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  let updated: Admin;
  try {
    // 单条 update: 用户名与密码变更原子生效
    updated = await prisma.admin.update({ where: { id: admin.id }, data });
  } catch (err) {
    // 并发下唯一约束冲突 (P2002) -> 友好提示
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw badRequest("USERNAME_TAKEN", "该用户名已被占用");
    }
    throw err;
  }

  return {
    username: updated.username,
    usernameChanged: wantUsername,
    passwordChanged: wantPassword,
  };
}
