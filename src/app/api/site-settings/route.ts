import { getSettings } from "@/services/settings-service";
import { jsonError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await getSettings();
    return Response.json({ siteName: s.siteName, redemptionPaused: s.redemptionPaused, pauseReason: s.redemptionPaused ? s.pauseReason : "", purchaseUrl: s.purchaseUrl, disclaimer: s.disclaimer }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return jsonError(err); }
}
