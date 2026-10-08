/**
 * esim.gg 错误 -> 用户可读信息映射 (规格 §51)
 */
import { EsimApiError } from "@/lib/esim/errors";

export interface FriendlyError {
  code: string;
  message: string;
}

const RATE_LIMITED: FriendlyError = {
  code: "RATE_LIMITED",
  message: "操作过于频繁，请稍后再试；选号时也可先前往官网挑号。",
};

const NUMBER_UNAVAILABLE: FriendlyError = {
  code: "NUMBER_UNAVAILABLE",
  message: "该号码已售出或暂时不可用，请重新选择其他号码。",
};

const WALLET_INSUFFICIENT: FriendlyError = {
  code: "WALLET_INSUFFICIENT",
  message: "平台可用余额不足，暂时无法开通，请稍后再试或联系客服。",
};

function rawText(err: EsimApiError): string {
  return `${err.errorCode ?? ""} ${err.message}`.toLowerCase();
}

/** 购买失败的用户提示 */
export function purchaseErrorMessage(err: EsimApiError | null): FriendlyError {
  if (!err) return { code: "PURCHASE_FAILED", message: "号码未能成功购买，请重新选号；如持续失败，请联系客服。" };
  if (err.statusCode === 429 || /rate|limit|too many/.test(rawText(err))) {
    return RATE_LIMITED;
  }
  if (
    /unavailable|not available|taken|already|conflict|409/.test(rawText(err))
  ) {
    return NUMBER_UNAVAILABLE;
  }
  if (/insufficient|balance|funds|wallet|credit/.test(rawText(err))) {
    return WALLET_INSUFFICIENT;
  }
  if (err.kind === "uncertain") {
    return {
      code: "PURCHASE_UNCERTAIN",
      message: "正在核验官方购买结果，结果确认前不会再次购买。请稍后刷新订单状态或联系客服。",
    };
  }
  return { code: "PURCHASE_FAILED", message: "号码未能成功购买，请重新选号；如持续失败，请联系客服。" };
}

/** 转移失败的用户提示 (规格 §51) */
export function transferErrorMessage(err: EsimApiError | null): FriendlyError {
  if (!err) {
    return {
      code: "TRANSFER_FAILED",
      message: "号码已购买，但转移未完成。请稍后重试或联系客服；重试不会再次购买号码。",
    };
  }
  if (err.statusCode === 429 || /rate|limit|too many/.test(rawText(err))) {
    return RATE_LIMITED;
  }
  if (
    /recipient|account|userid|user id|not found|not_found|multiple|invalid/.test(
      rawText(err),
    )
  ) {
    return {
      code: "TRANSFER_RECIPIENT_INVALID",
      message:
        "号码已购买，但接收账号无法接收。请核对 UserID 或已注册邮箱后重新提交转移，不会再次购买号码。",
    };
  }
  if (err.kind === "uncertain") {
    return {
      code: "TRANSFER_UNCERTAIN",
      message: "暂时无法确认转移结果，请先登录 esim.gg 查看号码；如未收到，请刷新订单状态或联系客服。不会再次购买号码。",
    };
  }
  return {
    code: "TRANSFER_FAILED",
    message: "号码已购买，但转移未完成。请稍后重试或联系客服；重试不会再次购买号码。",
  };
}
