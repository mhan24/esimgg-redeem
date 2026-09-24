"use client";

/**
 * 订单状态页 (规格 §21/§50/§51)
 * - COMPLETED: 成功页
 * - TRANSFER_FAILED: 修改邮箱重新转移
 * - PURCHASE_UNCERTAIN / PURCHASED / TRANSFERRING: 轮询等待
 * - FAILED: 失败, 返回重新选号
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Spinner,
  Steps,
  formatMsisdn,
  formatPrice,
} from "@/components/ui";
import { UseridGuide } from "@/components/UseridGuide";
import { PublicShell } from "@/components/PublicShell";

interface OrderData {
  token: string;
  msisdn: string;
  numberPrice: string;
  initialBalance: string;
  recipientEmail: string | null;
  recipientAccountId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  purchasedAt: string | null;
  completedAt: string | null;
}

const POLL_STATUSES = ["PENDING", "PURCHASING", "PURCHASED", "TRANSFERRING", "PURCHASE_UNCERTAIN"];

export function OrderView({ token }: { token: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userid, setUserid] = useState("");
  const [retrying, setRetrying] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "订单不存在或已失效");
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setError(null);
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // 订单状态需要进入页面即加载并按状态轮询, setState 均在异步回调中触发
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // 状态轮询
  useEffect(() => {
    if (!order || !POLL_STATUSES.includes(order.status)) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [order, load]);

  async function onRetry(e: FormEvent) {
    e.preventDefault();
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${token}/retry-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: userid.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "重新转移失败，请稍后再试");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <PublicShell>
        <main className="w-full max-w-lg">
          <Card className="items-center gap-3 rounded-2xl py-12 text-center shadow-sm">
            <Spinner label="正在加载订单状态…" />
          </Card>
        </main>
      </PublicShell>
    );
  }

  if (!order) {
    return (
      <PublicShell>
        <main className="w-full max-w-lg">
        <Card className="gap-4 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-foreground">无法打开订单</h1>
            <p className="mt-1 text-sm text-muted-foreground">请检查链接是否完整，或返回首页重新开始。</p>
          </div>
          <Alert kind="error">{error ?? "订单不存在"}</Alert>
          <Button className="w-full" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </Card>
        </main>
      </PublicShell>
    );
  }

  const completed = order.status === "COMPLETED";
  const transferFailed = order.status === "TRANSFER_FAILED";
  const uncertain = order.status === "PURCHASE_UNCERTAIN";
  const failed = order.status === "FAILED";

  return (
    <PublicShell>
      <main className="w-full max-w-2xl">
        <Card className="gap-5 rounded-2xl shadow-sm ring-border/90">
          <Steps current={completed ? 4 : 3} />

          {completed && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CircleCheck aria-hidden className="size-6 text-success-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">兑换成功</h1>
              <dl className="space-y-2 rounded-xl bg-muted/50 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">号码</dt>
                  <dd className="font-code font-medium">
                    {formatMsisdn(order.msisdn)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">已转移至</dt>
                  <dd className="font-medium">
                    {order.recipientAccountId ?? order.recipientEmail}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                请登录 esim.gg 查看号码。
              </p>
            </div>
          )}

          {transferFailed && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-foreground">等待重新转移</h1>
              <Alert kind="warning">
                <p>
                  号码：
                  <span className="font-code">{formatMsisdn(order.msisdn)}</span>
                </p>
                <p>状态：号码购买成功，等待转移</p>
                <p>转移失败：{order.errorCode ?? "未知错误"}</p>
              </Alert>
              <p className="text-sm text-muted-foreground">
                请确认新的接收 UserID 正确，然后重新提交。
                系统不会重复购买号码。
              </p>
              <form onSubmit={onRetry} className="space-y-3">
                <div>
                  <Label htmlFor="retry-userid">新的 esim.gg UserID</Label>
                  <Input
                    id="retry-userid"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="cm 开头的 UserID"
                    className="font-code"
                    value={userid}
                    onChange={(e) => setUserid(e.target.value.trim())}
                  />
                </div>
                <UseridGuide />
                {error && <Alert kind="error">{error}</Alert>}
                <Button
                  type="submit"
                  loading={retrying}
                  disabled={!userid.trim()}
                  className="w-full"
                >
                  重新转移
                </Button>
              </form>
            </div>
          )}

          {uncertain && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-foreground">购买结果核实中</h1>
              <Alert kind="warning">
                系统正在向 esim.gg 核实购买结果，请稍后刷新查看。
                不会重复购买号码，不会重复扣费。
              </Alert>
              <p className="text-sm text-muted-foreground">
                号码：<span className="font-code">{formatMsisdn(order.msisdn)}</span>
              </p>
              <Button variant="secondary" onClick={load} className="w-full">
                刷新状态
              </Button>
            </div>
          )}

          {(order.status === "PURCHASED" || order.status === "TRANSFERRING" || order.status === "PURCHASING" || order.status === "PENDING") && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-foreground">正在处理</h1>
              <Alert kind="info">
                号码购买成功，正在转移至你的 esim.gg 账户，请稍候…
              </Alert>
              <p className="text-sm text-muted-foreground">
                号码：<span className="font-code">{formatMsisdn(order.msisdn)}</span>
              </p>
              <Button variant="secondary" onClick={load} className="w-full">
                刷新状态
              </Button>
            </div>
          )}

          {failed && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-foreground">兑换未完成</h1>
              <Alert kind="error">
                {order.errorMessage ?? "兑换失败，兑换码未消耗，请重新选号。"}
              </Alert>
              <Button className="w-full" onClick={() => router.push("/redeem")}>
                重新选号
              </Button>
            </div>
          )}

          <dl className="mt-6 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>号码价格</dt>
              <dd>{formatPrice(order.numberPrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>初始余额</dt>
              <dd>€{order.initialBalance}</dd>
            </div>
          </dl>
        </Card>
      </main>
    </PublicShell>
  );
}
