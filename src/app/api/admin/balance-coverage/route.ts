import { requireAdmin } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getBalanceCoverage } from '@/services/balance-coverage-service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { await requireAdmin(); return jsonOk(await getBalanceCoverage()); }
  catch (err) { return jsonError(err); }
}
