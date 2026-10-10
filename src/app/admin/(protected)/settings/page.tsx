"use client";

/**
 * 系统设置页 (规格 §6/§7/§71)
 * API Key 多账号管理见 ApiKeyManager; 本页负责选号设置
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  PageHeading,
  Spinner,
} from "@/components/ui";
import { WalletCostEstimate } from "@/components/WalletCostEstimate";
import { SiteOperationsSettings } from "@/components/SiteOperationsSettings";
import { TelegramSettings } from "@/components/TelegramSettings";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SettingsData {
  siteName: string;
  initialBalance: string;
  allowFreeNumbers: boolean;
  allowPaidNumbers: boolean;
  maxPaidNumberPrice: string;
  numberType: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 选号设置表单
  const [siteName, setSiteName] = useState("");
  const [initialBalance, setInitialBalance] = useState("0.05");
  const [allowFree, setAllowFree] = useState(true);
  const [allowPaid, setAllowPaid] = useState(false);
  const [maxPrice, setMaxPrice] = useState("2.00");
  const [numberType, setNumberType] = useState("global");

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.message ?? "加载失败");
      return;
    }
    setData(json);
    setSiteName(json.siteName);
    setInitialBalance(json.initialBalance);
    setAllowFree(json.allowFreeNumbers);
    setAllowPaid(json.allowPaidNumbers);
    setMaxPrice(json.maxPaidNumberPrice);
    setNumberType(json.numberType);
    setError(null);
  }, [router]);

  // 进入页面: 拉取设置 (内联 fetch: 避免 effect 内调用含 setState 的函数)
  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? "加载失败");
          return;
        }
        setData(json);
        setSiteName(json.siteName);
        setInitialBalance(json.initialBalance);
        setAllowFree(json.allowFreeNumbers);
        setAllowPaid(json.allowPaidNumbers);
        setMaxPrice(json.maxPaidNumberPrice);
        setNumberType(json.numberType);
        setError(null);
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [router]);

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          initialBalance,
          allowFreeNumbers: allowFree,
          allowPaidNumbers: allowPaid,
          maxPaidNumberPrice: maxPrice,
          numberType,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "保存失败");
        return;
      }
      window.dispatchEvent(new Event("site-settings-updated"));
      router.refresh();
      setNotice("设置已保存");
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <Card>
        <Spinner label="加载中…" />
      </Card>
    );
  }

  return (
    <div className="w-full space-y-5">
      <PageHeading
        title="系统设置"
      />
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Tabs defaultValue="site" className="gap-6">
        <TabsList variant="line" className="min-h-12 w-full justify-start border-b border-border pb-2">
          <TabsTrigger value="site" className="flex-none px-4">站点</TabsTrigger>
          <TabsTrigger value="redeem" className="flex-none px-4">兑换</TabsTrigger>
          <TabsTrigger value="keys" className="flex-none px-4">API Key</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-none px-4">通知</TabsTrigger>
        </TabsList>
        <TabsContent value="site" keepMounted><div className="space-y-5"><Card>
          <form onSubmit={onSaveSettings} className="space-y-4">
            <div><Label htmlFor="site-name">站点名称</Label><Input id="site-name" value={siteName} onChange={e => setSiteName(e.target.value)} /></div>
            <Button type="submit" loading={saving}>保存名称</Button>
          </form>
        </Card><SiteOperationsSettings /></div></TabsContent>
        <TabsContent value="keys" keepMounted><div className="space-y-5"><ApiKeyManager /></div></TabsContent>
        <TabsContent value="notifications" keepMounted><TelegramSettings /></TabsContent>
        <TabsContent value="redeem" keepMounted><Card>
        <h2 className="text-base font-semibold text-foreground">兑换规则</h2>
        <form onSubmit={onSaveSettings} className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="initial-balance">初始余额（EUR）</Label>
            <Input
              id="initial-balance"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              号码开通后的初始余额。最低金额以该账户的官方规则为准。
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">允许号码类型</p>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <Switch
                  checked={allowFree}
                  onCheckedChange={setAllowFree}
                  aria-label="允许免费号码"
                />
                免费号码
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <Switch
                  checked={allowPaid}
                  onCheckedChange={setAllowPaid}
                  aria-label="允许付费号码"
                />
                付费号码
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="max-price">付费号码最高价格（EUR）</Label>
            <Input
              id="max-price"
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              disabled={!allowPaid}
            />
          </div>
          <div>
            <Label htmlFor="number-type">号码类型</Label>
            <select
              id="number-type"
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
              value={numberType}
              onChange={(e) => setNumberType(e.target.value)}
            >
              <option value="global">Global</option>
              <option value="asia">Asia</option>
            </select>
          </div>
          <div className="sm:col-span-2"><WalletCostEstimate numberPrice="0.00" initialBalance={initialBalance} /></div>
          <div className="sm:col-span-2"><Button type="submit" loading={saving}>保存兑换规则</Button></div>
        </form>
      </Card></TabsContent>
      </Tabs>
    </div>
  );
}
