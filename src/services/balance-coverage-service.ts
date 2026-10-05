import { prisma } from '@/lib/prisma';
import { calculateCoverage } from '@/lib/balance-coverage';
import { toCents } from '@/lib/money';
import { estimateWalletCost } from '@/lib/esim/cost';
import { getSettings } from '@/services/settings-service';

export async function getBalanceCoverage() {
  const now = new Date();
  const settings = await getSettings();
  const snapshot = await prisma.$transaction(async tx => {
    const keys = await tx.esimApiKey.findMany({ select: { enabled: true, lastBalance: true, lastBalanceAt: true, lastError: true } });
    const unused = await tx.redeemCode.count({ where: { status: 'UNUSED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } });
    const locked = await tx.redeemCode.count({ where: { status: 'LOCKED' } });
    return { keys, unused, locked };
  }, { isolationLevel: 'RepeatableRead' });
  const estimate = estimateWalletCost(settings.allowPaidNumbers ? settings.maxPaidNumberPrice.toString() : '0', settings.initialBalance.toString());
  if (!estimate) throw new Error('Invalid wallet cost settings');
  return calculateCoverage(snapshot.keys.map(k => ({ enabled: k.enabled, balanceCents: k.lastBalance === null ? null : toCents(k.lastBalance), checkedAt: k.lastBalanceAt?.getTime() ?? null, hasError: !!k.lastError })), snapshot.unused, snapshot.locked, toCents(estimate.total), now.getTime());
}
