'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { PublicSiteSettings } from '@/lib/site-settings';
import { Alert, Button, Card, Input, Label, Spinner } from '@/components/ui';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
export function SiteOperationsSettings() {
  const [data, setData] = useState<PublicSiteSettings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/site-settings', { cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error();
      const value = await res.json();
      if (active) setData(value);
    }).catch(() => { if (active) setError('无法加载站点设置，请刷新页面。'); });
    return () => { active = false; };
  }, []);
  function update(patch: Partial<PublicSiteSettings>) { setData(old => old ? { ...old, ...patch } : old); setNotice(''); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/site-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const value = await res.json();
      if (!res.ok) throw new Error(value.message ?? '保存失败');
      window.dispatchEvent(new Event('site-settings-updated'));
      setNotice('站点设置已保存，前台将在下次刷新时同步。');
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
    finally { setBusy(false); }
  }
  return <Card className="space-y-4">
    <h2 className="text-sm font-semibold">兑换开关与前台说明</h2>
    {error && <Alert kind="error">{error}</Alert>}{notice && <Alert kind="success">{notice}</Alert>}
    {!data ? !error && <Spinner label="加载站点设置…" /> : <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <label className="flex items-center gap-3 text-sm"><Switch checked={data.redemptionPaused} onCheckedChange={redemptionPaused => update({ redemptionPaused })} aria-label="暂停兑换" />暂停兑换</label>
      <p className="text-xs text-muted-foreground">保存后立即停止新的兑换申请，未使用卡密也不能兑换。已经受理的订单继续处理。</p>
      <div><Label htmlFor="pause-reason">前台暂停原因（可选）</Label><Input id="pause-reason" value={data.pauseReason} maxLength={300} onChange={e => update({ pauseReason: e.target.value })} placeholder="留空则只显示暂停兑换" /></div>
      <div className="flex flex-wrap gap-2">{['系统维护中，请稍后再试。', '正在补充资源，请稍后再试。', ''].map(reason => <Button key={reason} type="button" variant="outline" onClick={() => update({ pauseReason: reason })}>{reason || '不展示原因'}</Button>)}</div>
      <div><Label htmlFor="purchase-url">卡密购买地点</Label><Input id="purchase-url" type="url" maxLength={2048} value={data.purchaseUrl} onChange={e => update({ purchaseUrl: e.target.value })} placeholder="https://…" /></div>
      <div><Label htmlFor="support-url">在线客服链接</Label><Input id="support-url" type="url" maxLength={2048} value={data.supportUrl} onChange={e => update({ supportUrl: e.target.value })} placeholder="https://t.me/…" /><p className="mt-2 text-xs text-muted-foreground">用于选号须知与付费号码协助办理，留空可隐藏客服入口。</p></div>
      <div><Label htmlFor="site-disclaimer">免责声明</Label><Textarea id="site-disclaimer" className="min-h-40" maxLength={5000} value={data.disclaimer} onChange={e => update({ disclaimer: e.target.value })} /><p className="mt-2 text-xs text-muted-foreground">支持换行和完整网址，留空可隐藏对应内容。</p></div>
      <Button type="submit" loading={busy}>保存站点设置</Button>
    </fieldset></form>}
  </Card>;
}
