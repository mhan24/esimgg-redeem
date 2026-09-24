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
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { Switch } from "@/components/ui/switch";

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
    <div className="space-y-5">
      <PageHeading
        title="系统设置"
        description="配置号码类型、价格边界和平台 API 凭证。"
      />
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <ApiKeyManager />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">选号设置</h2>
        <form onSubmit={onSaveSettings} className="space-y-4">
          <div>
            <Label htmlFor="site-name">站点名称</Label>
            <Input
              id="site-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="initial-balance">初始余额（EUR）</Label>
            <Input
              id="initial-balance"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              购买号码时初始化的账户余额。esim.gg 标准最低 1.00 EUR，账户可能存在专属最低值；
              若 API 拒绝该金额，真实错误会记录到订单日志。
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
          <Button type="submit" loading={saving}>
            保存
          </Button>
        </form>
      </Card>
    </div>
  );
}
