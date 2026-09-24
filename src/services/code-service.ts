/**
 * 卡密服务 (规格 §14-§18)
 * 生成使用 crypto 安全随机数 (规格 §15), 禁止 Math.random()
 */
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/http";
import { Prisma } from "@prisma/client";
import type { RedeemCode, RedeemCodeStatus } from "@prisma/client";

/** 去除易混淆字符 (I/O/0/1) 的 32 位字母表 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LEN = 4;

function randomGroup(): string {
  let out = "";
  for (let i = 0; i < GROUP_LEN; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/** 生成 `PREFIX-XXXX-XXXX-XXXX` 或 `XXXX-XXXX-XXXX` */
function generateCode(prefix: string): string {
  const body = Array.from({ length: GROUPS }, randomGroup).join("-");
  return prefix ? `${prefix}-${body}` : body;
}

export interface GenerateCodesParams {
  count: number;
  prefix?: string;
  /** 有效天数; null/undefined = 永久 */
  expiresInDays?: number | null;
  remark?: string;
  batchId?: string;
}

export async function generateCodes(
  params: GenerateCodesParams,
): Promise<RedeemCode[]> {
  const count = Math.floor(params.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw badRequest("COUNT_INVALID", "生成数量必须在 1-1000 之间");
  }
  const prefix = (params.prefix ?? "").trim().toUpperCase();
  if (prefix && !/^[A-Z0-9]{1,12}$/.test(prefix)) {
    throw badRequest("PREFIX_INVALID", "前缀仅支持 1-12 位字母或数字");
  }
  const remark = params.remark?.trim() || null;
  const expiresAt =
    params.expiresInDays && params.expiresInDays > 0
      ? new Date(Date.now() + params.expiresInDays * 86_400_000)
      : null;

  const created: RedeemCode[] = [];
  const batchId =
    params.batchId ?? `B${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomInt(1000, 9999)}`;

  // 逐批生成, UNIQUE 冲突时重试 (规格 §15)
  for (let i = 0; i < count; i++) {
    let code: RedeemCode | null = null;
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateCode(prefix);
      try {
        code = await prisma.redeemCode.create({
          data: { code: candidate, expiresAt, remark, batchId },
        });
      } catch (e) {
        const isUniqueViolation =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002";
        if (!isUniqueViolation) throw e;
      }
    }
    if (!code) throw conflict("CODE_GENERATION_FAILED", "卡密生成冲突，请重试");
    created.push(code);
  }
  return created;
}

export interface ListCodesParams {
  status?: RedeemCodeStatus;
  search?: string;
  batchId?: string;
  page?: number;
  pageSize?: number;
}

export async function listCodes(params: ListCodesParams) {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const where: Prisma.RedeemCodeWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.batchId) where.batchId = params.batchId;
  if (params.search) where.code = { contains: params.search, mode: "insensitive" };

  const [total, items] = await Promise.all([
    prisma.redeemCode.count({ where }),
    prisma.redeemCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, page, pageSize, items };
}

export async function findCodeByCode(code: string): Promise<RedeemCode | null> {
  return prisma.redeemCode.findUnique({ where: { code } });
}

export async function setCodeStatus(
  id: string,
  status: RedeemCodeStatus,
): Promise<RedeemCode> {
  const existing = await prisma.redeemCode.findUnique({ where: { id } });
  if (!existing) throw notFound("卡密不存在");
  if (existing.status === "USED") {
    throw conflict("CODE_USED", "已完成的卡密不能修改状态");
  }
  if (status === "DISABLED" && existing.status !== "UNUSED") {
    throw conflict("CODE_NOT_UNUSED", "仅未使用的卡密可以禁用");
  }
  if (status === "UNUSED" && existing.status !== "DISABLED") {
    throw conflict("CODE_NOT_DISABLED", "仅禁用的卡密可以启用");
  }
  return prisma.redeemCode.update({ where: { id }, data: { status } });
}

/** 删除未使用卡密 (规格 §14) */
export async function deleteUnusedCode(id: string): Promise<void> {
  const result = await prisma.redeemCode.deleteMany({
    where: { id, status: "UNUSED" },
  });
  if (result.count === 0) {
    throw conflict("CODE_NOT_UNUSED", "仅未使用的卡密可以删除");
  }
}

/** 导出卡密 (规格 §14: TXT / CSV) */
export async function exportCodes(params: {
  format: "txt" | "csv";
  status?: RedeemCodeStatus;
  batchId?: string;
}): Promise<{ filename: string; contentType: string; body: string }> {
  const where: Prisma.RedeemCodeWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.batchId) where.batchId = params.batchId;
  const codes = await prisma.redeemCode.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  if (params.format === "txt") {
    return {
      filename: `esimgg-codes-${Date.now()}.txt`,
      contentType: "text/plain; charset=utf-8",
      body: codes.map((c) => c.code).join("\n") + (codes.length ? "\n" : ""),
    };
  }
  const header = "code,status,batch_id,remark,expires_at,created_at";
  const rows = codes.map((c) =>
    [
      c.code,
      c.status,
      c.batchId ?? "",
      (c.remark ?? "").replace(/"/g, '""'),
      c.expiresAt ? c.expiresAt.toISOString() : "",
      c.createdAt.toISOString(),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
  return {
    filename: `esimgg-codes-${Date.now()}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: [header, ...rows].join("\n") + "\n",
  };
}
