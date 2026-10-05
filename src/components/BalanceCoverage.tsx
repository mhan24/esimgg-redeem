'use client';
import { useEffect, useState } from 'react';
import type { BalanceCoverage as Coverage } from '@/lib/balance-coverage';
import { Alert, Button, Card, Spinner } from '@/components/ui';
const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export function BalanceCoverage({ revision = '', onRecommendation }: { revision?: string; onRecommendation?: (count: number) => void }) {
  const [data, setData] = useState<Coverage | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/balance-coverage', { cache: 'no-store' });
        if (!res.ok) throw new Error('无法加载余额与卡密统计');
        const value = await res.json();
        if (active) { setData(value); setError(''); onRecommendation?.(value.reliable ? value.additionalCodes : 0); }
      } catch { if (active) setError('无法更新统计，请重试。下方可能是上次的数据。'); }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [revision, refresh, onRecommendation]);
  return <Card className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">余额与未使用卡密</h2><Button variant="outline" onClick={() => setRefresh(v => v + 1)}>更新统计</Button></div>
    {error && <Alert kind="error">{error}</Alert>}
    {!data && !error && <Spinner label="计算余额覆盖情况…" />}
    {data && <>
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">所有 Key 已知余额合计</dt><dd className="mt-1 text-xl font-semibold">{eur(data.allBalanceCents)}</dd><p className="text-xs text-muted-foreground">共 {data.keyCount} 个 Key{data.unknownKeys > 0 && `，${data.unknownKeys} 个余额未知`}</p></div>
        <div><dt className="text-muted-foreground">启用 Key 可用余额</dt><dd className="mt-1 text-xl font-semibold">{eur(data.availableCents)}</dd><p className="text-xs text-muted-foreground">{data.enabledKeys} 个启用 Key</p></div>
        <div><dt className="text-muted-foreground">未使用卡密预计金额</dt><dd className="mt-1 text-xl font-semibold">{eur(data.liabilityCents)}</dd><p className="text-xs text-muted-foreground">{data.unused} 张 × {eur(data.unitCents)}</p></div>
      </dl>
      {data.locked > 0 && <p className="text-sm text-muted-foreground">另为 {data.locked} 张处理中卡密预留 {eur(data.reservedCents)}，避免重复分配余额。</p>}
      {!error && <Alert kind={data.status === 'unknown' || data.status === 'shortage' || data.fragmented ? 'warning' : 'success'}>
        {data.status === 'unknown' ? '余额数据不完整、超过 10 分钟未更新，或存在检测异常。请在 API Key 管理中刷新余额后再决定生成数量。' : data.status === 'shortage' ? `卡密过多，请禁用/删除 ${data.excessCodes} 张未使用卡密，或者补充 ${eur(data.topUpCents)} 余额。` : data.fragmented ? '总余额足够，但分散在不同钱包，部分余额不足以单独支付一张卡密。请为钱包补足单次兑换金额。' : data.status === 'matched' ? '余额与卡密金额匹配，目前可继续生成 0 张。' : `余额充足，卡密可以继续生成 ${data.additionalCodes} 张。`}
      </Alert>}
      {data.status === 'shortage' && data.topUpCents > data.liabilityCents && <p className="text-sm text-muted-foreground">即使禁用全部未使用卡密，仍需补充处理中订单的预留资金。</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">按当前选号设置的最高预计成本计算，不计支付手续费；不含已禁用、已过期卡密。增发数量同时考虑单个钱包可支付的完整张数。余额按 Key 累加，同一钱包请勿重复添加 Key。统计每 30 秒更新，钱包余额约每 5 分钟检测，建议仅供参考。</p>
    </>}
  </Card>;
}
