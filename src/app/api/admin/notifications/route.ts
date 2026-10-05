import { requireAdmin, assertTrustedOrigin } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { badRequest, clientIp, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/services/settings-service";
import { writeAudit } from "@/services/audit-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const s = await getSettings();
    return jsonOk({ enabled: s.telegramEnabled, chatId: s.telegramChatId ?? "", tokenConfigured: !!s.encryptedTelegramToken });
  } catch (err) { return jsonError(err); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    assertTrustedOrigin(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.enabled !== "boolean" || typeof body.chatId !== "string" || typeof body.token !== "string") {
      throw badRequest("INVALID_SETTINGS", "通知配置格式不正确");
    }
    const chatId = body.chatId.trim();
    const token = body.token.trim();
    if (chatId && !/^(?:-?[1-9]\d{0,19}|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(chatId)) {
      throw badRequest("INVALID_CHAT_ID", "请输入数字 Chat ID 或 @频道用户名");
    }
    if (token && !/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(token)) {
      throw badRequest("INVALID_BOT_TOKEN", "机器人 Token 格式不正确");
    }
    const before = await getSettings();
    const encryptedToken = token ? encryptSecret(token) : before.encryptedTelegramToken;
    if (body.enabled && (!encryptedToken || !chatId)) {
      throw badRequest("TELEGRAM_NOT_CONFIGURED", "启用通知前请填写机器人 Token 和目标 Chat ID");
    }
    await prisma.systemSetting.update({ where: { id: 1 }, data: {
      telegramEnabled: body.enabled, telegramChatId: chatId || null, encryptedTelegramToken: encryptedToken,
    } });
    await writeAudit({ adminId: admin.adminId, action: "TELEGRAM_SETTINGS_UPDATE", targetType: "system_setting", targetId: "1", metadata: { enabled: body.enabled, tokenChanged: !!token }, ip: clientIp(req) });
    return jsonOk({ ok: true });
  } catch (err) { return jsonError(err); }
}
