/**
 * esim.gg API 类型定义 (依据 https://github.com/esimgg/api)
 */

export interface WalletBalance {
  currency: string;
  balance: number;
}

export interface NumberSearchResult {
  msisdn: string;
  price: number;
}

export interface SearchNumbersParams {
  search?: string;
  type: string; // global | asia
  zeroPriceOnly: boolean;
}

export interface PurchaseNumberParams {
  msisdn: string;
  /** EUR 字符串, 两位小数, 来自后台 initial_balance (规格 §24) */
  rechargeAmount: string;
}

export interface PurchaseResult {
  /** 响应体原文 (存入订单 purchase_response) */
  raw: unknown;
}

export interface LineInfo {
  number: string;
  [key: string]: unknown;
}

export interface TransferOwnershipParams {
  msisdn: string;
  /** recipient_email 与 recipient_account_id 二选一 (官方文档) */
  recipientEmail?: string;
  recipientAccountId?: string;
}
