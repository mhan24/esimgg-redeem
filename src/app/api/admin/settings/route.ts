/**
 * GET /api/admin/settings (规格 §6/§7) — 选号设置
 * PATCH /api/admin/settings — 更新选号设置 / 站点名称 / API Key 策略; 敏感变更写审计 (规格 §38)
 */
import { prisma } from "@/lib/prisma";
import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { writeAudit } from "@/services/audit-service";
import { updateKeySettings } from "@/services/api-key-service";
import {
  ApiError,
  badRequest,
  clientIp,
  jsonError,
  jsonOk,
} from "@/lib/http";
import { parseEurInput } from "@/lib/money";
import { logger } from "@/lib/logger";
import { getSelectionSettings, getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [settings, selection] = await Promise.all([
      getSettings(),
      getSelectionSettings(),
    ]);
    return jsonOk({
      siteName: settings.siteName,
      ...selection,
      keyStrategy: settings.keyStrategy,
      keyLowBalanceThreshold: settings.keyLowBalanceThreshold.toString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const before = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    if (!before) throw badRequest("SETTINGS_MISSING", "系统设置缺失");

    const data: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (body.siteName !== undefined) {
      const v = String(body.siteName).trim();
      if (!v || v.length > 60) {
        throw badRequest("SITE_NAME_INVALID", "站点名称 1-60 字符");
      }
      if (v !== before.siteName) {
        data.siteName = v;
        changes.siteName = v;
      }
    }

    if (body.initialBalance !== undefined) {
      const cents = parseEurInput(body.initialBalance);
      if (cents === null || cents > 100_000) {
        throw badRequest("INITIAL_BALANCE_INVALID", "初始余额格式不正确");
      }
      if (cents !== Math.round(Number(before.initialBalance) * 100)) {
        data.initialBalance = (cents / 100).toFixed(2);
        changes.initialBalance = data.initialBalance;
      }
    }

    if (body.allowFreeNumbers !== undefined) {
      const v = Boolean(body.allowFreeNumbers);
      if (v !== before.allowFreeNumbers) {
        data.allowFreeNumbers = v;
        changes.allowFreeNumbers = v;
      }
    }

    if (body.allowPaidNumbers !== undefined) {
      const v = Boolean(body.allowPaidNumbers);
      if (v !== before.allowPaidNumbers) {
        data.allowPaidNumbers = v;
        changes.allowPaidNumbers = v;
      }
    }

    if (body.maxPaidNumberPrice !== undefined) {
      const cents = parseEurInput(body.maxPaidNumberPrice);
      if (cents === null || cents > 100_000) {
        throw badRequest("MAX_PRICE_INVALID", "最高价格格式不正确");
      }
      if (cents !== Math.round(Number(before.maxPaidNumberPrice) * 100)) {
        data.maxPaidNumberPrice = (cents / 100).toFixed(2);
        changes.maxPaidNumberPrice = data.maxPaidNumberPrice;
      }
    }

    if (body.numberType !== undefined) {
      const v = String(body.numberType);
      if (!["global", "asia"].includes(v)) {
        throw badRequest("NUMBER_TYPE_INVALID", "号码类型仅支持 global / asia");
      }
      if (v !== before.numberType) {
        data.numberType = v;
        changes.numberType = v;
      }
    }

    // 模式 D 检查: 不允许两个开关同时关闭 (规格 §10)
    const nextFree =
      (data.allowFreeNumbers as boolean | undefined) ?? before.allowFreeNumbers;
    const nextPaid =
      (data.allowPaidNumbers as boolean | undefined) ?? before.allowPaidNumbers;
    if (!nextFree && !nextPaid) {
      throw badRequest("SELECTION_CLOSED", "免费与付费号码不能同时关闭");
    }

    if (Object.keys(data).length > 0) {
      await prisma.systemSetting.update({ where: { id: 1 }, data });
      await writeAudit({
        adminId: admin.adminId,
        action: "SETTINGS_UPDATE",
        targetType: "system_setting",
        targetId: "1",
        metadata: changes,
        ip: clientIp(req),
      });
      logger.info("系统设置更新", changes);
    }

    // API Key 调用策略与低余额预警阈值 (规格 §71)
    const keySettings = await updateKeySettings({
      keyStrategy: body.keyStrategy,
      keyLowBalanceThreshold: body.keyLowBalanceThreshold,
    });
    if (body.keyStrategy !== undefined || body.keyLowBalanceThreshold !== undefined) {
      await writeAudit({
        adminId: admin.adminId,
        action: "SETTINGS_UPDATE",
        targetType: "system_setting",
        targetId: "1",
        metadata: {
          keyStrategy: keySettings.keyStrategy,
          keyLowBalanceThreshold: keySettings.keyLowBalanceThreshold,
        },
        ip: clientIp(req),
      });
    }

    return jsonOk({ ok: true, ...keySettings });
  } catch (err) {
    return jsonError(err);
  }
}
