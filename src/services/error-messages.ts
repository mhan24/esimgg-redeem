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
  message: "请求过于频繁，请稍后再试。",
};

const NUMBER_UNAVAILABLE: FriendlyError = {
  code: "NUMBER_UNAVAILABLE",
  message: "该号码已不可用，请重新选择号码。",
};

const WALLET_INSUFFICIENT: FriendlyError = {
  code: "WALLET_INSUFFICIENT",
  message: "系统余额不足，请联系管理员。",
};

function rawText(err: EsimApiError): string {
  return `${err.errorCode ?? ""} ${err.message}`.toLowerCase();
}

/** 购买失败的用户提示 */
export function purchaseErrorMessage(err: EsimApiError | null): FriendlyError {
  if (!err) return { code: "PURCHASE_FAILED", message: "购买失败，请重新选择号码。" };
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
      message: "购买结果正在核实中，请稍后刷新查看或联系管理员。不会重复扣费。",
    };
  }
  return { code: "PURCHASE_FAILED", message: "购买失败，请重新选择号码。" };
}

/** 转移失败的用户提示 (规格 §51) */
export function transferErrorMessage(err: EsimApiError | null): FriendlyError {
  if (!err) {
    return {
      code: "TRANSFER_FAILED",
      message: "号码转移失败，请稍后重试或联系管理员。不会重复购买号码。",
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
        "号码已经购买成功，但无法转移至该 UserID。请确认 UserID 正确且已注册 esim.gg，然后重新提交。不会重复购买号码。",
    };
  }
  if (err.kind === "uncertain") {
    return {
      code: "TRANSFER_UNCERTAIN",
      message: "转移结果不确定，请稍后重试。不会重复购买号码。",
    };
  }
  return {
    code: "TRANSFER_FAILED",
    message: "号码转移失败，请稍后重试或联系管理员。不会重复购买号码。",
  };
}
