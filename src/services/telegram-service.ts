import type { Order } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { ApiError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getSettings } from "./settings-service";

/** Never propagate fetch errors: their messages can contain the token in the URL. */
export async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) throw new Error("Telegram rejected message");
  } catch {
    throw new ApiError(502, "TELEGRAM_SEND_FAILED", "通知发送失败，请检查机器人 Token、目标 Chat ID、发消息权限和服务器网络。");
  }
}

export async function sendTelegramTest() {
  const settings = await getSettings();
  if (!settings.encryptedTelegramToken || !settings.telegramChatId) {
    throw new ApiError(400, "TELEGRAM_NOT_CONFIGURED", "请先保存机器人 Token 和目标 Chat ID。");
  }
  await sendTelegramMessage(decryptSecret(settings.encryptedTelegramToken), settings.telegramChatId,
    `${settings.siteName}\nTelegram 测试通知：连接成功，卡密使用通知将发送到这里。`);
}

/** Best effort after the USED transition commits; never changes the redemption result. */
export async function notifyCodeUsed(order: Order): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.telegramEnabled || !settings.encryptedTelegramToken || !settings.telegramChatId) return;
    const text = [
      `${settings.siteName} · 卡密已使用`,
      `订单：${order.id}`,
      `卡密 ID：${order.redeemCodeId}`,
      `号码：****${order.msisdn.slice(-4)}`,
      `号码费用：€${order.numberPrice.toFixed(2)}`,
      `初始余额：€${order.initialBalance.toFixed(2)}`,
      `完成时间：${order.completedAt?.toISOString() ?? new Date().toISOString()}`,
    ].join("\n");
    await sendTelegramMessage(decryptSecret(settings.encryptedTelegramToken), settings.telegramChatId, text);
  } catch {
    logger.warn("Telegram 卡密使用通知发送失败", { orderId: order.id });
  }
}
