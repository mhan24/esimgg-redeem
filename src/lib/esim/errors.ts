/**
 * esim.gg API 统一错误 (规格 §59)
 *
 * kind:
 *  - "definitive": 明确的业务失败 (4xx / success:false), 可安全释放卡密
 *  - "uncertain" : 结果未知 (超时/网络错误/5xx/429), 必须走 /line/all 对账,
 *                  严禁直接重试购买 (规格 §26/§27)
 */
export type EsimFailureKind = "definitive" | "uncertain";

export class EsimApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  response?: unknown;
  kind: EsimFailureKind;

  constructor(params: {
    message: string;
    kind: EsimFailureKind;
    statusCode?: number;
    errorCode?: string;
    response?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "EsimApiError";
    this.kind = params.kind;
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.response = params.response;
    if (params.cause !== undefined) this.cause = params.cause;
  }

  static definitive(
    message: string,
    statusCode?: number,
    errorCode?: string,
    response?: unknown,
    cause?: unknown,
  ): EsimApiError {
    return new EsimApiError({
      message,
      kind: "definitive",
      statusCode,
      errorCode,
      response,
      cause,
    });
  }

  static uncertain(
    message: string,
    statusCode?: number,
    errorCode?: string,
    response?: unknown,
    cause?: unknown,
  ): EsimApiError {
    return new EsimApiError({
      message,
      kind: "uncertain",
      statusCode,
      errorCode,
      response,
      cause,
    });
  }
}

/** 从错误响应体中提取 error code / message */
export function parseEsimErrorBody(body: unknown): {
  errorCode?: string;
  message?: string;
} {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const errorCode = typeof b.error === "string" ? b.error : undefined;
    const message =
      typeof b.message === "string"
        ? b.message
        : typeof b.error === "string"
          ? b.error
          : undefined;
    return { errorCode, message };
  }
  if (typeof body === "string" && body.trim()) {
    return { message: body.slice(0, 500) };
  }
  return {};
}
