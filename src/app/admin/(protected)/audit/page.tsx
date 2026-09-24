"use client";

/**
 * 审计日志页 (规格 §38)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Alert, Button, Card, EmptyState, PageHeading } from "@/components/ui";

interface AuditItem {
  id: string;
  adminId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/audit?page=${page}&pageSize=${pageSize}`, {
      cache: "no-store",
    });
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
  }, [page, router]);

  useEffect(() => {
    let cancelled = false;
    const loadAudit = async () => {
      try {
        const res = await fetch(`/api/admin/audit?page=${page}&pageSize=${pageSize}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message ?? "加载失败");
          return;
        }
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      } catch {
        if (!cancelled) setError("网络错误");
      }
    };
    void loadAudit();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, router]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeading
        title="审计日志"
        description="记录后台操作、关联对象和请求来源。"
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden className="size-4" /> 刷新
          </Button>
        }
      />
      {error && <Alert kind="error">{error}</Alert>}
      <Card>
        {items.length === 0 ? (
          <EmptyState text="暂无日志" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">时间</th>
                  <th className="pb-2 pr-3 font-medium">操作</th>
                  <th className="pb-2 pr-3 font-medium">对象</th>
                  <th className="pb-2 pr-3 font-medium">详情</th>
                  <th className="pb-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 align-top">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium text-foreground">
                      {a.action}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {a.targetType ?? "-"}
                      {a.targetId ? `:${a.targetId.slice(0, 8)}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      <pre className="max-w-md overflow-auto whitespace-pre-wrap break-all">
                        {a.metadata ? JSON.stringify(a.metadata) : "-"}
                      </pre>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{a.ip ?? "-"}</td>
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
    </div>
  );
}
