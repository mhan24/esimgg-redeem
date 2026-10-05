export interface CoverageKey {
  enabled: boolean;
  balanceCents: number | null;
  checkedAt: number | null;
  hasError: boolean;
}

/** Wallet snapshots are advisory; prices and balances can change before purchase. */
export function calculateCoverage(keys: CoverageKey[], unused: number, locked: number, unitCents: number, now: number) {
  const enabled = keys.filter(k => k.enabled);
  const allBalanceCents = keys.reduce((sum, k) => sum + (k.balanceCents ?? 0), 0);
  const availableCents = enabled.reduce((sum, k) => sum + (k.balanceCents ?? 0), 0);
  const unknownKeys = keys.filter(k => k.balanceCents === null).length;
  const unreliableKeys = enabled.filter(k => k.balanceCents === null || k.checkedAt === null || now - k.checkedAt > 10 * 60_000 || k.hasError).length;
  const liabilityCents = unused * unitCents;
  const reservedCents = locked * unitCents;
  const differenceCents = availableCents - liabilityCents - reservedCents;
  const reliable = enabled.length > 0 && unreliableKeys === 0 && unitCents > 0;
  const walletCapacity = unitCents > 0 ? enabled.reduce((sum, k) => sum + Math.floor(Math.max(0, k.balanceCents ?? 0) / unitCents), 0) : 0;
  return {
    unused, locked, unitCents, liabilityCents, reservedCents, allBalanceCents, availableCents,
    keyCount: keys.length, enabledKeys: enabled.length, unknownKeys, unreliableKeys, reliable,
    differenceCents,
    status: !reliable ? 'unknown' : differenceCents < 0 ? 'shortage' : differenceCents === 0 ? 'matched' : 'surplus',
    additionalCodes: reliable ? Math.max(0, Math.min(Math.floor(differenceCents / unitCents), walletCapacity - unused - locked)) : 0,
    excessCodes: reliable && differenceCents < 0 ? Math.min(unused, Math.ceil(-differenceCents / unitCents)) : 0,
    topUpCents: Math.max(0, -differenceCents),
    fragmented: reliable && walletCapacity < unused + locked && differenceCents >= 0,
  };
}
export type BalanceCoverage = ReturnType<typeof calculateCoverage>;
