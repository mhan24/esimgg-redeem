/**
 * 统一 API 错误与响应助手 (规格 §59)
 */

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(status: number, code: string, message?: string, detail?: unknown) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function badRequest(code: string, message?: string) {
  return new ApiError(400, code, message);
}

export function unauthorized(message = "未登录或会话已过期") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "禁止访问") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "不存在") {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(code: string, message?: string) {
  return new ApiError(409, code, message);
}

export function tooManyRequests(retryAfterSec: number) {
  return new ApiError(429, "RATE_LIMITED", "请求过于频繁，请稍后再试。", {
    retryAfterSec,
  });
}

export function serverError(message = "服务器内部错误") {
  return new ApiError(500, "INTERNAL", message);
}

export function jsonError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: err.code, message: err.message, detail: err.detail },
      { status: err.status },
    );
  }
  // 不向前端泄露内部错误堆栈 (规格 §50)
  console.error("[api] 未处理错误:", err);
  return Response.json(
    { error: "INTERNAL", message: "服务器内部错误" },
    { status: 500 },
  );
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** 获取客户端 IP (限流键用) */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}
