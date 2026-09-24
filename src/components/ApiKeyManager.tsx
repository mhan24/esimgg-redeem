"use client";

/**
 * API Key 多账号管理 (规格 §71)
 * 策略 (顺序/随机) + 低余额预警阈值 + Key 增删启用禁用排序 + 余额检测
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Spinner,
} from "@/components/ui";

interface KeyItem {
  id: string;
  name: string;
  maskedKey: string;
  enabled: boolean;
  sortOrder: number;
  lastUsedAt: string | null;
  lastBalance: string | null;
  lastBalanceAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface KeysData {
  keys: KeyItem[];
  keyStrategy: string;
  keyLowBalanceThreshold: string;
}

export function ApiKeyManager() {
  const router = useRouter();
  const [data, setData] = useState<KeysData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 新增表单
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);

  // 策略与阈值
  const [strategy, setStrategy] = useState("sequential");
  const [threshold, setThreshold] = useState("2.99");
  const [savingStrategy, setSavingStrategy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/api-keys", { cache: "no-store" });
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
    setStrategy(json.keyStrategy ?? "sequential");
    setThreshold(json.keyLowBalanceThreshold ?? "2.99");
    setError(null);
  }, [router]);

  // 进入页面: 拉取 Key 列表 (内联 fetch: 避免 effect 内调用含 setState 的函数)
  useEffect(() => {
    fetch("/api/admin/api-keys", { cache: "no-store" })
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
        setStrategy(json.keyStrategy ?? "sequential");
        setThreshold(json.keyLowBalanceThreshold ?? "2.99");
        setError(null);
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [router]);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!newName.trim() || !newKey.trim()) {
      setError("请填写备注名和 API Key");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), apiKey: newKey.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "添加失败");
        return;
      }
      setNotice(`已添加 Key：${newName.trim()}`);
      setNewName("");
      setNewKey("");
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setAdding(false);
    }
  }

  async function onPatch(id: string, payload: Record<string, unknown>) {
    resetMessages();
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "操作失败");
        return;
      }
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(key: KeyItem) {
    resetMessages();
    const ok = window.confirm(
      `确定删除 Key「${key.name}」？\n删除后使用该 Key 购买的订单将失去关联（不影响已完成订单）。`,
    );
    if (!ok) return;
    setBusyId(key.id);
    try {
      const res = await fetch(`/api/admin/api-keys/${key.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "删除失败");
        return;
      }
      setNotice(`已删除 Key：${key.name}`);
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function onTest(id: string) {
    resetMessages();
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}/test`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message ?? "连接失败");
        return;
      }
      setNotice(`连接正常，余额 €${Number(json.wallet?.balance ?? 0).toFixed(2)}`);
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveStrategy(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setSavingStrategy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyStrategy: strategy, keyLowBalanceThreshold: threshold }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "保存失败");
        return;
      }
      setNotice("调用策略已保存");
      await reload();
    } catch {
      setError("网络错误");
    } finally {
      setSavingStrategy(false);
    }
  }

  if (loading && !data) {
    return (
      <Card>
        <Spinner label="加载中…" />
      </Card>
    );
  }

  const keys = data?.keys ?? [];
  const thresholdNum = Number(data?.keyLowBalanceThreshold ?? 2.99);

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          esim.gg API Key 管理
        </h2>
        <div className="mb-3 rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          支持多个 Key。购买时按策略选用，余额不足自动切换到下一个 Key；
          同一个订单的购买与转移固定使用同一个 Key。
          Key 加密保存于服务端，不会发送到浏览器。
        </div>

        <form onSubmit={onSaveStrategy} className="mb-4 space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">调用策略</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="strategy"
                  value="sequential"
                  checked={strategy === "sequential"}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="h-4 w-4"
                />
                按顺序调用（从第一个到最后一个，余额不足就下一个）
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="strategy"
                  value="random"
                  checked={strategy === "random"}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="h-4 w-4"
                />
                随机调用
              </label>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-48">
              <Label htmlFor="low-balance">低余额预警阈值（EUR）</Label>
              <Input
                id="low-balance"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" loading={savingStrategy}>
              保存策略
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            任一启用的 Key 余额低于阈值时，仪表盘会显示预警。
          </p>
        </form>

        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
            尚未配置 API Key，请在下方添加
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">备注名</th>
                  <th className="pb-2 pr-3 font-medium">Key</th>
                  <th className="pb-2 pr-3 font-medium">余额</th>
                  <th className="pb-2 pr-3 font-medium">状态</th>
                  <th className="pb-2 pr-3 font-medium">最近使用</th>
                  <th className="pb-2 pr-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => {
                  const low =
                    k.enabled &&
                    k.lastBalance !== null &&
                    Number(k.lastBalance) < thresholdNum;
                  return (
                    <tr key={k.id} className="border-b border-border/70">
                      <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {k.name}
                      </td>
                      <td className="py-2.5 pr-3 font-code text-muted-foreground">
                        {k.maskedKey}
                      </td>
                      <td className="py-2.5 pr-3">
                        {k.lastBalance === null ? (
                          <span className="text-muted-foreground">未检测</span>
                        ) : (
                          <span className={low ? "font-medium text-destructive" : "text-foreground"}>
                            €{Number(k.lastBalance).toFixed(2)}
                            {low && " ⚠"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={
                            k.enabled
                              ? "rounded-md bg-success/5 px-2 py-0.5 text-success-foreground"
                              : "rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
                          }
                        >
                          {k.enabled ? "启用" : "禁用"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleString("zh-CN")
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="text-primary hover:underline disabled:text-muted-foreground/60"
                            disabled={busyId === k.id}
                            onClick={() => onTest(k.id)}
                          >
                            检测
                          </button>
                          <button
                            className="text-primary hover:underline disabled:text-muted-foreground/60"
                            disabled={busyId === k.id}
                            onClick={() => onPatch(k.id, { enabled: !k.enabled })}
                          >
                            {k.enabled ? "禁用" : "启用"}
                          </button>
                          <button
                            className="text-primary hover:underline disabled:text-muted-foreground/60"
                            disabled={busyId === k.id || i === 0}
                            onClick={() => onPatch(k.id, { direction: "up" })}
                          >
                            上移
                          </button>
                          <button
                            className="text-primary hover:underline disabled:text-muted-foreground/60"
                            disabled={busyId === k.id || i === keys.length - 1}
                            onClick={() => onPatch(k.id, { direction: "down" })}
                          >
                            下移
                          </button>
                          <button
                            className="text-destructive hover:underline disabled:text-muted-foreground/60"
                            disabled={busyId === k.id}
                            onClick={() => onDelete(k)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">添加 API Key</h2>
        <form onSubmit={onAdd} className="space-y-3">
          <div>
            <Label htmlFor="key-name">备注名</Label>
            <Input
              id="key-name"
              autoComplete="off"
              placeholder="如：主账号 / 备用账号"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="key-value">API Key</Label>
            <Input
              id="key-value"
              type="password"
              autoComplete="off"
              placeholder="esim.gg 的 API Key"
              className="font-code"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <Button type="submit" loading={adding} disabled={!newName.trim() || !newKey.trim()}>
            添加
          </Button>
        </form>
      </Card>
    </>
  );
}
