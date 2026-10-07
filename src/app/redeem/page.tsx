"use client";
import { NumberSelectionGuide } from "@/components/NumberSelectionGuide";
import { usePublicSiteSettings } from "@/components/PublicSiteNotice";

/**
 * 选号页: 搜索 -> 选择 -> 确认 (规格 §22-§25)
 */
import { useCallback, useEffect, useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
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
  const [selectionMode, setSelectionMode] = useState<"direct" | "search">("direct");
  const [targetNumber, setTargetNumber] = useState("");
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
    if (searching || submitting || checkingOrder || submissionBlocked || siteSettings?.redemptionPaused) return;
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
      if ((data.numbers ?? []).length === 0) {
        setNotice("没有找到符合条件的号码，请尝试其他特征码。");
      }
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSearching(false);
    }
  }, [search, router, searching, submitting, checkingOrder, submissionBlocked, siteSettings?.redemptionPaused]);

  async function onSelectTarget(e: FormEvent) {
    e.preventDefault();
    if (searching || submitting || checkingOrder || submissionBlocked || siteSettings?.redemptionPaused) return;
    const target = targetNumber.replace(/\D/g, "");
    if (!/^\d{6,15}$/.test(target)) { setError("请输入包含国家区号的完整目标号码（6–15 位数字）。"); return; }
    setSearching(true); setSelected(null); setNumbers([]); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/numbers/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: target }) });
      const data = await res.json();
      if (res.status === 401) { router.replace("/"); return; }
      if (!res.ok) { setError(data.message ?? "暂时无法核验目标号码，请稍后再试。"); return; }
      const number = (data.numbers ?? []).find((n: NumberItem) => n.msisdn.replace(/\D/g, "") === target);
      if (!number) { setError("目标号码当前未出现在可兑换号源中，请前往官方确认库存。如为付费或特选号码，请联系在线客服协助补差与转移。"); return; }
      if (Number(number.price) > 0) { setError("该号码为付费号码，请联系在线客服补足差价并协助办理转移。"); return; }
      setNumbers([]); setSelected(number);
      setNotice(null);
    } catch { setError("网络连接失败，暂时无法核验号码，请稍后再试。"); }
    finally { setSearching(false); }
  }

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
      <main className="w-full max-w-xl">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{selected ? "02 / 接收账号" : "01 / 选择号码"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{selected ? "确认兑换" : "选择你的号码"}</h1>
        </div>

        {!selected && <Card className="mb-4 gap-5 rounded-xl shadow-sm">
          <div className="flex gap-1 rounded-lg bg-muted p-1" aria-label="选号方式">
            <Button type="button" variant={selectionMode === "direct" ? "secondary" : "ghost"} aria-pressed={selectionMode === "direct"} disabled={searching || submitting} onClick={() => setSelectionMode("direct")} className="flex-1">输入号码</Button>
            <Button type="button" variant={selectionMode === "search" ? "secondary" : "ghost"} aria-pressed={selectionMode === "search"} disabled={searching || submitting} onClick={() => setSelectionMode("search")} className="flex-1">搜索号码</Button>
          </div>
          {selectionMode === "direct" && <form onSubmit={onSelectTarget} className="space-y-2">
            <Label htmlFor="target-number">目标号码</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="target-number" inputMode="tel" autoComplete="off" value={targetNumber} onChange={e => setTargetNumber(e.target.value)} maxLength={40} placeholder="粘贴官方号码，包含国家区号" className="h-11 font-code" />
              <Button type="submit" loading={searching} disabled={!targetNumber.trim() || siteSettings?.redemptionPaused || submitting || checkingOrder || submissionBlocked} className="shrink-0">使用此号码</Button>
            </div>
            <p className="text-xs text-muted-foreground">包含国家区号，可直接粘贴官方号码。</p>
          </form>}
          {selectionMode === "search" && <form onSubmit={doSearch}>
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
                  setSearch(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
              />
              <Button type="submit" loading={searching} disabled={siteSettings?.redemptionPaused || submitting || checkingOrder || submissionBlocked} className="shrink-0">
                <Search aria-hidden className="size-4" />
                搜索
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              短时间内连续搜索可能触发限流。
            </p>
          </form>}
          <a href="https://esim.gg" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline underline-offset-4">前往官方挑选号码 ↗</a>
        </Card>}

        {error && (
          <div ref={errorRef} className="mb-4" role="alert" tabIndex={-1}>
            <Alert kind="error">{error}</Alert>
            {siteSettings?.supportUrl && <a href={siteSettings.supportUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline underline-offset-4">联系在线客服</a>}
            {submissionBlocked && <Button className="mt-3" onClick={() => router.replace("/")}>返回首页查看订单状态</Button>}
          </div>
        )}
        {notice && !error && (
          <div className="mb-4">
            <Alert kind="info">{notice}</Alert>
          </div>
        )}

        {!selected && selectionMode === "search" && numbers.length > 0 && (
          <Card className="gap-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">搜索结果</h2>
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
          <Card className="gap-5 rounded-xl shadow-sm">

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

              <UseridGuide />


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

        <NumberSelectionGuide supportUrl={siteSettings?.supportUrl} />
      </main>
    </PublicShell>
  );
}
