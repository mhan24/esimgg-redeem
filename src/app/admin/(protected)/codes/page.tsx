"use client";

/**
 * 卡密管理页 (规格 §14)
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  StatusBadge,
  PageHeading,
} from "@/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CodeItem {
  id: string;
  code: string;
  status: string;
  batchId: string | null;
  remark: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["", "UNUSED", "LOCKED", "PURCHASED", "USED", "DISABLED"];
const PAGE_SIZE = 20;
export default function AdminCodesPage() {
  const router = useRouter();
  const [items, setItems] = useState<CodeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 生成表单
  const [count, setCount] = useState("100");
  const [prefix, setPrefix] = useState("ESIM");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [remark, setRemark] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CodeItem | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/codes?${params}`, { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "加载失败");
      return;
    }
    setItems(data.items);
    setTotal(data.total);
  }, [page, status, search, router]);

  useEffect(() => {
    let canceled = false;
    const fetchCodes = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (status) params.set("status", status);
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/codes?${params}`, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (canceled) return;
        if (!res.ok) {
          setError(data.message ?? "加载失败");
          return;
        }
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      } catch {
        if (!canceled) setError("网络错误");
      }
    };
    void fetchCodes();
    return () => {
      canceled = true;
    };
  }, [page, status, search, router]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(count),
          prefix,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          remark,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "生成失败");
        return;
      }
      setGenerated(data.codes);
      setNotice(`已生成 ${data.count} 个卡密（批次 ${data.batchId}）`);
      await load();
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }

  async function act(id: string, action: "disable" | "enable" | "delete") {
    setError(null);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/codes/${id}`, { method: "DELETE" })
          : await fetch(`/api/admin/codes/${id}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "操作失败");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("网络错误");
      return false;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (await act(deleteTarget.id, "delete")) setDeleteTarget(null);
  }

  function exportUrl(format: "txt" | "csv") {
    const params = new URLSearchParams({ format });
    if (status) params.set("status", status);
    return `/api/admin/codes/export?${params}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeading
        title="卡密管理"
        description="生成兑换卡密并管理状态、批次和导出。"
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden className="size-4" /> 刷新
          </Button>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">生成卡密</h2>
        <form onSubmit={onGenerate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="count">数量</Label>
            <Input
              id="count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <Label htmlFor="prefix">前缀</Label>
            <Input
              id="prefix"
              value={prefix}
              onChange={(e) =>
                setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))
              }
              placeholder="ESIM"
            />
          </div>
          <div>
            <Label htmlFor="expires">有效期（天，空=永久）</Label>
            <Input
              id="expires"
              inputMode="numeric"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value.replace(/\D/g, ""))}
              placeholder="永久"
            />
          </div>
          <div>
            <Label htmlFor="remark">备注</Label>
            <Input
              id="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="独角第一批"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" loading={generating}>
              生成
            </Button>
          </div>
        </form>

        {generated && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                本次生成（仅显示一次，请及时导出）
              </p>
              <div className="flex gap-2">
                <a
                  href={exportUrl("txt")}
                  className="text-xs text-primary hover:underline"
                >
                  导出 TXT
                </a>
                <a
                  href={exportUrl("csv")}
                  className="text-xs text-primary hover:underline"
                >
                  导出 CSV
                </a>
              </div>
            </div>
            <textarea
              readOnly
              value={generated.join("\n")}
              className="h-32 w-full rounded-lg border border-border bg-card p-2 font-code text-xs"
            />
          </div>
        )}
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="filter-status">状态</Label>
            <select
              id="filter-status"
              className="h-11 rounded-xl border border-input bg-card px-3 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "全部"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filter-search">搜索卡密</Label>
            <Input
              id="filter-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ESIM-"
              className="font-code"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <a
              href={exportUrl("txt")}
              className="inline-flex h-11 items-center rounded-xl border border-input bg-card px-4 text-sm text-foreground hover:bg-muted/50"
            >
              <Download aria-hidden className="mr-1.5 size-4" /> 导出 TXT
            </a>
            <a
              href={exportUrl("csv")}
              className="inline-flex h-11 items-center rounded-xl border border-input bg-card px-4 text-sm text-foreground hover:bg-muted/50"
            >
              <Download aria-hidden className="mr-1.5 size-4" /> 导出 CSV
            </a>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState text="暂无卡密" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">卡密</th>
                  <th className="pb-2 pr-3 font-medium">状态</th>
                  <th className="pb-2 pr-3 font-medium">批次</th>
                  <th className="pb-2 pr-3 font-medium">备注</th>
                  <th className="pb-2 pr-3 font-medium">创建时间</th>
                  <th className="pb-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-muted/40">
                    <td className="py-2.5 pr-3 font-code text-xs">{c.code}</td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {c.batchId ?? "-"}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {c.remark ?? "-"}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        {c.status === "UNUSED" && (
                          <button
                            type="button"
                            onClick={() => act(c.id, "disable")}
                            className="text-xs text-destructive hover:underline"
                          >
                            禁用
                          </button>
                        )}
                        {c.status === "DISABLED" && (
                          <button
                            type="button"
                            onClick={() => act(c.id, "enable")}
                            className="text-xs text-success-foreground hover:underline"
                          >
                            启用
                          </button>
                        )}
                        {c.status === "UNUSED" && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除未使用卡密？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除卡密 <span className="font-code text-foreground">{deleteTarget?.code}</span>。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={(event) => {
              event.preventDefault();
              void confirmDelete();
            }}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
