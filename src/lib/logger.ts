/**
 * 日志脱敏 (规格 §47: 不记录完整 API Key, 邮箱按权限脱敏)
 */
import { maskEmail, maskSecret } from "./crypto";

const SENSITIVE_KEY = /(api[-_ ]?key|password|secret|token|cookie|authorization)/i;

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = typeof v === "string" && v.length > 0 ? "***" : v;
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: unknown) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const logger = {
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
  /** 记录涉及 API Key 的事件时仅存掩码 */
  apiKey: (k: string) => maskSecret(k),
  email: (e: string) => maskEmail(e),
};
