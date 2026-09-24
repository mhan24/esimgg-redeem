"use client";

/**
 * 订单面板 (规格 §39/§40) — 订单管理 / 异常订单共用
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeading,
  StatusBadge,
  formatMsisdn,
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrderItem {
  id: string;
  code: string;
  msisdn: string;
  numberPrice: string;
  initialBalance: string;
  recipientEmail: string | null;
  recipientAccountId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  purchasedAt: string | null;
  completedAt: string | null;
}

interface OrderDetail extends OrderItem {
  codeStatus: string;
  purchaseResponse: unknown;
  transferResponse: unknown;
  /** 官方实付成本 (规格 §71) */
  apiKeyName?: string | null;
  costTotal: string | null;
  costBreakdown: {
    total: number | null;
    numberPrice: number | null;
    vatAmount: number | null;
    currency?: string;
    estimatedTotal?: string | null;
    source?: string;
  } | null;
}

const STATUS_OPTIONS = [
  "",
  "PENDING",
  "PURCHASING",
  "PURCHASE_UNCERTAIN",
  "PURCHASED",
  "TRANSFERRING",
  "TRANSFER_FAILED",
  "COMPLETED",
  "FAILED",
];
const PAGE_SIZE = 20;

export function OrdersBoard({ mode }: { mode: "all" | "exceptions" }) {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(mode === "exceptions" ? "" : "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [retryUserId, setRetryUserId] = useState("");
  const [retryEmail, setRetryEmail] = useState("");
  const [acting, setActing] = useState(false);
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (mode === "exceptions") {
      params.set("status", "EXCEPTIONS");
    } else if (status) {
      params.set("status", status);
    }
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
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
  }, [page, status, search, mode, router]);

  useEffect(() => {
    let cancelled = false;
    const loadOrders = async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (mode === "exceptions") {
        params.set("status", "EXCEPTIONS");
      } else if (status) {
        params.set("status", status);
      }
      if (search) params.set("search", search);
      try {
        const res = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
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
    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [page, status, search, mode, router]);

  async function openDetail(id: string) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "加载失败");
      return;
    }
    setDetail(data);
    setRetryUserId(data.recipientAccountId ?? "");
    setRetryEmail(data.recipientEmail ?? "");
  }

  async function onRetryTransfer(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setActing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${detail.id}/retry-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid: retryUserId.trim() || undefined,
          email: retryEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "重试失败");
        return;
      }
      setNotice(`转移成功，订单状态：${data.status}`);
      await load();
      await openDetail(detail.id);
    } catch {
      setError("网络错误");
    } finally {
      setActing(false);
    }
  }

  async function onReconcile() {
    if (!detail) return;
    if (!confirm("确认号码已在平台账户中？将标记购买成功并继续转移。")) return;
    setActing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${detail.id}/reconcile`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "对账失败");
        return;
      }
      setNotice(`对账完成，订单状态：${data.status}`);
      await load();
      await openDetail(detail.id);
    } catch {
      setError("网络错误");
    } finally {
      setActing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeading
        title={mode === "exceptions" ? "异常订单" : "订单管理"}
        description={mode === "exceptions" ? "查看待核实购买和转移失败的订单。" : "跟踪号码购买、转移和交付状态。"}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden className="size-4" /> 刷新
          </Button>
        }
      />

      {mode === "exceptions" && (
        <Alert kind="info">
          重点处理：购买结果待核实（PURCHASE_UNCERTAIN）与转移失败（TRANSFER_FAILED）。
          转移失败仅支持修改邮箱 / 账户 ID 后重新转移，禁止重新购买。
        </Alert>
      )}

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {mode === "all" && (
            <div>
              <Label htmlFor="order-status">状态</Label>
              <select
                id="order-status"
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
          )}
          <div>
            <Label htmlFor="order-search">搜索（号码/邮箱/卡密）</Label>
            <Input
              id="order-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="372…"
              className="font-code"
            />
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState text="暂无订单" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">订单号</th>
                  <th className="pb-2 pr-3 font-medium">卡密</th>
                  <th className="pb-2 pr-3 font-medium">号码</th>
                  <th className="pb-2 pr-3 font-medium">价格</th>
                  <th className="pb-2 pr-3 font-medium">初始余额</th>
                  <th className="pb-2 pr-3 font-medium">邮箱</th>
                  <th className="pb-2 pr-3 font-medium">状态</th>
                  <th className="pb-2 pr-3 font-medium">创建时间</th>
                  <th className="pb-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 transition-colors hover:bg-muted/40">
                    <td className="py-2.5 pr-3 font-code text-xs">{o.id.slice(0, 8)}</td>
                    <td className="py-2.5 pr-3 font-code text-xs">{o.code}</td>
                    <td className="py-2.5 pr-3 font-code text-xs">
                      {formatMsisdn(o.msisdn)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">€{o.numberPrice}</td>
                    <td className="py-2.5 pr-3 text-xs">€{o.initialBalance}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {o.recipientEmail ?? o.recipientAccountId ?? "-"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => openDetail(o.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        详情
                      </button>
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

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        {detail && (
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>订单详情 {detail.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>查看订单状态、成本和平台响应，可在允许时重试转移。</DialogDescription>
          </DialogHeader>

          <dl className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">卡密</dt>
              <dd className="font-code">{detail.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">卡密状态</dt>
              <dd>
                <StatusBadge status={detail.codeStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">订单状态</dt>
              <dd>
                <StatusBadge status={detail.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">号码</dt>
              <dd className="font-code">{formatMsisdn(detail.msisdn)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">号码价格</dt>
              <dd>€{detail.numberPrice}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">初始余额</dt>
              <dd>€{detail.initialBalance}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">实付成本</dt>
              <dd>
                {detail.costTotal !== null ? (
                  <span className="font-medium text-success-foreground">
                    €{Number(detail.costTotal).toFixed(2)}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">API Key</dt>
              <dd>{detail.apiKeyName ?? "—"}</dd>
            </div>
            {detail.costBreakdown && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-muted-foreground">成本构成（官方实付）</dt>
                <dd className="mt-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>eSIM 号码费用</span>
                    <span>
                      {detail.costBreakdown.numberPrice === null
                        ? "—"
                        : `€${detail.costBreakdown.numberPrice.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>初始余额</span>
                    <span>€{Number(detail.initialBalance).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>增值税</span>
                    <span>
                      {detail.costBreakdown.vatAmount === null
                        ? "—"
                        : `€${detail.costBreakdown.vatAmount.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium text-foreground">
                    <span>实付合计</span>
                    <span>
                      €
                      {(
                        detail.costBreakdown.total ??
                        Number(detail.costTotal ?? 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                  {detail.costBreakdown.estimatedTotal && (
                    <div className="mt-1 flex justify-between text-muted-foreground">
                      <span>预估合计</span>
                      <span>€{detail.costBreakdown.estimatedTotal}</span>
                    </div>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">错误码</dt>
              <dd>{detail.errorCode ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">错误信息</dt>
              <dd className="break-all">{detail.errorMessage ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">重试次数</dt>
              <dd>{detail.retryCount}</dd>
            </div>
          </dl>

          {(detail.status === "TRANSFER_FAILED" || detail.status === "PURCHASED") && (            <form onSubmit={onRetryTransfer} className="mb-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                重新转移（填写 UserID；邮箱为可选的备用方式，二选一）
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="retry-userid">接收 UserID（cm 开头）</Label>
                  <Input
                    id="retry-userid"
                    value={retryUserId}
                    onChange={(e) => setRetryUserId(e.target.value)}
                    placeholder="cm..."
                    className="font-code"
                  />
                </div>
                <div>
                  <Label htmlFor="retry-email">接收邮箱（可选）</Label>
                  <Input
                    id="retry-email"
                    type="email"
                    value={retryEmail}
                    onChange={(e) => setRetryEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" loading={acting}>
                重新转移
              </Button>
            </form>
          )}

          {detail.status === "PURCHASE_UNCERTAIN" && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                购买结果待核实：确认号码已在平台账户后执行人工对账
              </p>
              <Button variant="danger" onClick={onReconcile} loading={acting}>
                确认购买成功并继续转移
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">内部响应</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              {JSON.stringify(
                {
                  purchaseResponse: detail.purchaseResponse,
                  transferResponse: detail.transferResponse,
                },
                null,
                2,
              )}
            </pre>
          </div>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
