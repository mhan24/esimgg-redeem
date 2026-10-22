"use client";

import { PublicButton as Button } from "@/components/arc/public-button";

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
  Card,
  Input,
  Label,
  Spinner,
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
  const [recipient, setRecipient] = useState("");
  const [retrying, setRetrying] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "无法找到订单，请返回首页输入原卡密查看。");
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setError(null);
    } catch {
      setError("暂时无法读取最新状态，请检查网络后刷新。");
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
        body: JSON.stringify(recipient.includes("@") ? { email: recipient.trim() } : { userid: recipient.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        await load();
        setError(data.message ?? "重新转移失败，请稍后再试");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("暂时无法读取最新状态，请检查网络后刷新。");
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
        <Card className="gap-4 rounded-2xl shadow-none">
          <div>
            <h1 className="text-lg font-semibold text-foreground">无法打开订单</h1>
            <p className="mt-1 text-sm text-muted-foreground">请检查链接是否完整，或返回首页输入原卡密查看。</p>
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
        <Card className="gap-5 rounded-2xl shadow-none ring-border/90">

          {completed && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CircleCheck aria-hidden className="size-6 text-success-foreground" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">号码已转入你的账户</h1>
              <dl className="space-y-2 rounded-xl bg-muted/50 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">已兑换号码</dt>
                  <dd className="font-code font-medium">
                    {formatMsisdn(order.msisdn)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">接收账户</dt>
                  <dd className="max-w-[65%] break-all text-right font-medium">
                    {order.recipientAccountId ?? order.recipientEmail}
                  </dd>
                </div>
              </dl>
              <section className="space-y-3 rounded-xl border border-border p-4 text-left text-sm leading-6" aria-labelledby="install-guide-title">
                <h2 id="install-guide-title" className="font-semibold">如何安装到手机？</h2>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>登录接收号码的 esim.gg 账户。</li>
                  <li>在账户的线路或号码列表中找到上方号码。</li>
                  <li>打开号码详情，查看 eSIM 安装信息或激活二维码。</li>
                  <li>按照官方指引，在支持 eSIM 的手机上添加此号码。</li>
                </ol>
                <a href="https://esim.gg" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">登录 esim.gg 查看安装信息 ↗</a>
              </section>
            </div>
          )}

          {transferFailed && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">号码已购买，转移未完成</h1>
              <Alert kind="warning">
                <p>
                  号码：
                  <span className="font-code">{formatMsisdn(order.msisdn)}</span>
                </p>
                <p>{order.errorMessage ?? "请核对接收账户后重试，或联系客服。重试只会转移号码，不会再次购买。"}</p>
              </Alert>
              <form onSubmit={onRetry} className="space-y-3">
                <div>
                  <Label htmlFor="retry-userid">接收账户</Label>
                  <Input
                    id="retry-userid"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="UserID（推荐）或 esim.gg 登录邮箱"
                    className="font-code"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value.trim())}
                  />
                </div>
                <UseridGuide />
                {error && <Alert kind="error">{error}</Alert>}
                <Button
                  type="submit"
                  loading={retrying}
                  disabled={!recipient.trim()}
                  className="w-full"
                >
                  重试转移
                </Button>
              </form>
            </div>
          )}

          {uncertain && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">购买结果待确认</h1>
              <Alert kind="warning">
                暂未收到明确的购买结果。请联系客服核实，勿再次兑换；确认前不会重复购买号码。
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
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">正在办理你的号码</h1>
              <Alert kind="info">
                {order.status === "PENDING" || order.status === "PURCHASING" ? "正在开通号码，请勿重复提交。办理进度会自动更新。" : "号码已开通，正在转入你的 esim.gg 账户。办理进度会自动更新。"}
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
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">本次兑换未成功</h1>
              <Alert kind="error">
                {order.errorMessage ?? "号码未能成功购买，卡密可继续使用，请重新选号。"}
              </Alert>
              <Button className="w-full" onClick={() => router.push("/redeem")}>
                返回重新选号
              </Button>
            </div>
          )}

          <dl className="mt-6 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>选号附加费</dt>
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
