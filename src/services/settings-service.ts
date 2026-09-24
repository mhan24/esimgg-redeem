/**
 * 系统设置服务 (规格 §7 / §37 / §6)
 *
 * 多 API Key 场景 (规格 §71): esim.gg Key 的增删启用与选用已移至
 * api-key-service / esim-gateway; 旧版单 Key (encryptedEsimApiKey) 仅作兜底。
 */
import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/http";
import type { SystemSetting } from "@prisma/client";

export interface SelectionSettings {
  initialBalance: string; // "0.05"
  allowFreeNumbers: boolean;
  allowPaidNumbers: boolean;
  maxPaidNumberPrice: string; // "2.00"
  numberType: string;
}

/** 读取设置单例 (不存在则创建) */
export async function getSettings(): Promise<SystemSetting> {
  const existing = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.systemSetting.create({ data: { id: 1 } });
}

export async function getSelectionSettings(): Promise<SelectionSettings> {
  const s = await getSettings();
  return {
    initialBalance: s.initialBalance.toString(),
    allowFreeNumbers: s.allowFreeNumbers,
    allowPaidNumbers: s.allowPaidNumbers,
    maxPaidNumberPrice: s.maxPaidNumberPrice.toString(),
    numberType: s.numberType,
  };
}

/** 系统尚未配置任何可用 Key */
export function noApiKeyError() {
  return serverError("尚未配置 esim.gg API Key，请联系管理员");
}
