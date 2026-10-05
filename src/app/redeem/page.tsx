"use client";
import { usePublicSiteSettings } from "@/components/PublicSiteNotice";

/**
 * 选号页: 搜索 -> 选择 -> 确认 (规格 §22-§25)
 */
import { useCallback, useEffect, useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Steps,
  formatMsisdn,
  formatPrice,
} from "@/components/ui";
import { UseridGuide } from "@/components/UseridGuide";
import { PublicShell } from "@/components/PublicShell";

interface NumberItem {
  msisdn: string;
  price: number;
}

interface SettingsInfo {
  initialBalance: string;
}

export default function RedeemPage() {
  const siteSettings = usePublicSiteSettings();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [selected, setSelected] = useState<NumberItem | null>(null);
  const [recipient, setRecipient] = useState("");
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [searching, setSearching] = useState(false);
  const submittingRef = useRef(false);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const [submissionBlocked, setSubmissionBlocked] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // 进入页面: 校验兑换会话 + 获取初始余额展示
  useEffect(() => {
    fetch("/api/redeem/context")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.order?.token) { router.replace(`/order/${data.order.token}`); return; }
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => undefined)
      .finally(() => setCheckingOrder(false));
  }, [router]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const doSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSelected(null);
    setSearching(true);
    try {
      const res = await fetch("/api/numbers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: search.trim() }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "搜索失败，请稍后再试");
        setNumbers([]);
        return;
      }
      setNumbers(data.numbers ?? []);
      setSearched(true);
      if ((data.numbers ?? []).length === 0) {
        setNotice("没有找到符合条件的号码，请尝试其他特征码。");
      }
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSearching(false);
    }
  }, [search, router]);

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!selected || submittingRef.current || checkingOrder || submissionBlocked) return;
    submittingRef.current = true;
    let navigating = false;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: selected.msisdn,
          ...(recipient.includes("@") ? { email: recipient.trim() } : { userid: recipient.trim() }),
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      if (!res.ok) {
        // 购买结果不确定时也跳转订单页查看状态
        if (data.order?.token) {
          navigating = true;
          router.replace(`/order/${data.order.token}`);
          return;
        }
        setError(data.message ?? "兑换失败，请重试");
        return;
      }
      navigating = true;
      router.replace(`/order/${data.order.token}`);
    } catch {
      // Recover a committed order even when the POST response was lost.
      try {
        const recovery = await fetch("/api/redeem/context", { cache: "no-store" });
        const context = await recovery.json();
        if (recovery.ok && context.order?.token) {
          navigating = true;
          router.replace(`/order/${context.order.token}`);
          return;
        }
      } catch { /* Keep purchase blocked until the customer checks the code again. */ }
      setSubmissionBlocked(true);
      setError("连接中断，暂时无法确认兑换结果。请返回首页重新输入卡密查看订单状态，再继续操作。");
    } finally {
      if (!navigating) { submittingRef.current = false; setSubmitting(false); }
    }
  }

  return (
    <PublicShell>
      <main className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
            号码选择
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {selected ? "确认号码并继续" : "找到你想要的号码"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            搜索号码开头或区号，选择后填写 esim.gg UserID 完成兑换。
          </p>
        </div>

        <Card className="mb-4 gap-5 rounded-2xl shadow-sm ring-border/90">
          <Steps current={selected ? 3 : 2} />
          <form onSubmit={doSearch}>
            <Label htmlFor="search">搜索号码</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                inputMode="numeric"
                autoComplete="off"
                placeholder="例如 37255"
                className="h-11 font-code"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
              />
              <Button type="submit" loading={searching} disabled={siteSettings?.redemptionPaused || submitting || checkingOrder || submissionBlocked} className="shrink-0">
                <Search aria-hidden className="size-4" />
                搜索
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              输入号码的数字特征；搜索结果会显示当前可选号码和价格。
            </p>
          </form>
        </Card>

        {error && (
          <div ref={errorRef} className="mb-4" role="alert" tabIndex={-1}>
            <Alert kind="error">{error}</Alert>
            {submissionBlocked && <Button className="mt-3" onClick={() => router.replace("/")}>返回首页查看订单状态</Button>}
          </div>
        )}
        {notice && !error && (
          <div className="mb-4">
            <Alert kind="info">{notice}</Alert>
          </div>
        )}

        {!selected && numbers.length > 0 && (
          <Card className="gap-4 rounded-2xl shadow-sm ring-border/90">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">搜索结果</h2>
                <p className="mt-1 text-xs text-muted-foreground">选择号码后确认接收账户</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {numbers.length} 个可选
              </span>
            </div>
            <ul className="divide-y divide-border/70">
              {numbers.map((n) => (
                <li
                  key={n.msisdn}
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-code text-base font-semibold tracking-wide text-foreground sm:text-lg">
                      {formatMsisdn(n.msisdn)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">可用</span>
                      <span className="text-xs text-muted-foreground">号码价格</span>
                      <span className="text-xs font-medium text-foreground">{formatPrice(n.price)}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      setSelected(n);
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    选择
                    <ArrowRight aria-hidden className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {selected && (
          <Card className="gap-5 rounded-2xl shadow-sm ring-border/90">
            <div>
              <h2 className="text-lg font-semibold text-foreground">确认兑换信息</h2>
              <p className="mt-1 text-sm text-muted-foreground">核对号码与费用，再填写接收账户。</p>
            </div>
            <dl className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">号码</dt>
                <dd className="font-code font-medium">
                  {formatMsisdn(selected.msisdn)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">号码价格</dt>
                <dd className="font-medium">{formatPrice(selected.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">初始余额</dt>
                <dd className="font-medium">
                  €{Number(settings?.initialBalance ?? 0.5).toFixed(2)}
                </dd>
              </div>
            </dl>
            <form onSubmit={onConfirm} className="space-y-4">
              <div>
                <Label htmlFor="userid">接收 esim.gg UserID 或邮箱</Label>
                <Input
                  id="userid"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="UserID（推荐）或 esim.gg 账户邮箱"
                  className="font-code"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                />
              </div>

              <p className="text-xs text-muted-foreground">推荐使用 UserID，可更准确地定位接收账号；也支持使用账户邮箱。</p>
                <UseridGuide />

              <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                推荐使用 UserID，也可以填写 esim.gg 账户邮箱。无需提供密码。
              </p>

              {submitting && <Alert kind="info">订单正在处理，请稍候。处理结果将自动跳转到订单页，请勿重复提交。</Alert>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                  className="flex-1"
                >
                  返回重选
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={!recipient.trim() || siteSettings?.redemptionPaused || checkingOrder || submissionBlocked}
                  className="flex-1"
                >
                  {submitting ? "正在购买并转移…" : checkingOrder ? "正在检查订单…" : "确认兑换"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!searched && !selected && (
          <p className="text-center text-sm text-muted-foreground">输入号码特征后点击搜索</p>
        )}
      </main>
    </PublicShell>
  );
}
