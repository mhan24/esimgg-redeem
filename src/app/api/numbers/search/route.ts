/**
 * POST /api/numbers/search (规格 §8-§11)
 * 需要兑换会话; 服务端执行模式过滤并落 SearchSession
 */
import { searchNumbersForCode } from "@/services/search-service";
import { getRedeemSession } from "@/lib/redeem-session";
import { ApiError, jsonError, jsonOk, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getRedeemSession();
    if (!session) throw unauthorized("请先输入兑换码");

    let body: { search?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    }

    const { numbers, expiresAt } = await searchNumbersForCode({
      codeId: session.codeId,
      search: typeof body.search === "string" ? body.search : "",
    });

    return jsonOk({
      numbers: numbers.map((n) => ({ msisdn: n.msisdn, price: n.price })),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}
