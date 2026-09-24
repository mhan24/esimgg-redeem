/**
 * 审计日志服务 (规格 §38)
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  adminId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    // 审计失败不阻断主流程, 但必须记录
    console.error("[audit] 写入失败", e);
  }
}

export async function listAudit(params: {
  page?: number;
  pageSize?: number;
  action?: string;
}) {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const where: Prisma.AuditLogWhereInput = {};
  if (params.action) where.action = params.action;
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, page, pageSize, items };
}
