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
  allowPaidNumbers: boolean;
  allowFreeNumbers: boolean;
  redemptionPaused: boolean;
}

interface InitialSelection {
  settings?: SettingsInfo;
  numbers?: NumberItem[];
  redirect?: string;
  error?: string;
  blocked?: boolean;
}

export default function RedeemPage() {
  const siteSettings = usePublicSiteSettings();
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState<"direct" | "search">("search");
  const [targetNumber, setTargetNumber] = useState("");
  const [search, setSearch] = useState("");
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [selected, setSelected] = useState<NumberItem | null>(null);
  const [recipient, setRecipient] = useState("");
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [searching, setSearching] = useState(true);
  const initialSelectionRef = useRef<Promise<InitialSelection> | null>(null);
  const submittingRef = useRef(false);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const [submissionBlocked, setSubmissionBlocked] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Each page mount shares one initial request, including React Strict Mode replay.
  // Resume existing orders before searching; a blank pattern asks for available numbers.
  useEffect(() => {
    let active = true;
    if (!initialSelectionRef.current) {
      initialSelectionRef.current = (async (): Promise<InitialSelection> => {
        let context;
        try {
          const res = await fetch("/api/redeem/context", { cache: "no-store" });
          if (res.status === 401) return { redirect: "/" };
          context = await res.json();
          if (!res.ok || !context.settings) return { error: context.message ?? "无法验证卡密，请返回首页重试。", blocked: true };
        } catch {
          return { error: "暂时无法验证卡密，请检查网络后返回首页重试。", blocked: true };
        }
        if (context.order?.token) return { redirect: `/order/${context.order.token}` };
        const settings: SettingsInfo = context.settings;
        if (settings.redemptionPaused || (!settings.allowFreeNumbers && !settings.allowPaidNumbers)) return { settings };
        try {
          const res = await fetch("/api/numbers/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search: "" }),
          });
          if (res.status === 401) return { redirect: "/" };
          const data = await res.json();
          if (!res.ok) return { settings, error: data.message ?? "暂时无法获取号码，请稍后手动检索或前往官网挑号。" };
          return { settings, numbers: data.numbers ?? [] };
        } catch {
          return { settings, error: "暂时无法获取号码，请检查网络后手动检索。" };
        }
      })();
    }
    void initialSelectionRef.current.then(data => {
      if (!active) return;
      if (data.redirect) { router.replace(data.redirect); return; }
      if (data.settings) setSettings(data.settings);
      if (data.numbers) {
        setNumbers(data.numbers);
        if (data.numbers.length === 0) setNotice("暂时没有可兑换号码，可稍后检索或前往官网挑号。");
      }
      if (data.error) setError(data.error);
      setSubmissionBlocked(data.blocked ?? false);
      setCheckingOrder(false);
      setSearching(false);
    });
    return () => { active = false; };
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
        setError(data.message ?? "暂时无法检索号码，请稍后重试或前往官网挑号");
        setNumbers([]);
        return;
      }
      setNumbers(data.numbers ?? []);
      if ((data.numbers ?? []).length === 0) {
        setNotice("未找到符合条件的可兑换号码。可更换数字，或前往官网挑号后使用「精准输入」。免费号源也可能暂时缺货。");
      }
    } catch {
      setError("网络连接异常，请检查网络后重试");
    } finally {
      setSearching(false);
    }
  }, [search, router, searching, submitting, checkingOrder, submissionBlocked, siteSettings?.redemptionPaused]);

  async function onSelectTarget(e: FormEvent) {
    e.preventDefault();
    if (searching || submitting || checkingOrder || submissionBlocked || siteSettings?.redemptionPaused) return;
    const target = targetNumber.replace(/\D/g, "");
    if (!/^\d{6,15}$/.test(target)) { setError("请输入包含国家区号的完整号码（6-15 位数字，例如 372 开头的号码）。"); return; }
    setSearching(true); setSelected(null); setNumbers([]); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/numbers/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: target }) });
      const data = await res.json();
      if (res.status === 401) { router.replace("/"); return; }
      if (!res.ok) { setError(data.message ?? "暂时无法核验目标号码，请稍后再试。"); return; }
      const number = (data.numbers ?? []).find((n: NumberItem) => n.msisdn.replace(/\D/g, "") === target);
      if (!number) { setError("未在可兑换号库中查到此号码，可能已售出或不在当前兑换范围内。请前往官网确认；付费号码请联系客服办理。"); return; }
      if (Number(number.price) > 0) { setError("该号码为付费号码，当前精准输入通道仅支持免费基础号码。请复制号码联系客服补差并办理转移。"); return; }
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
      <main className="w-full max-w-2xl">
        <div className="mb-8 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{selected ? "确认兑换并转移" : "挑选你的 eSIM 号码"}</h1>
          {!selected && settings && <p className="text-sm leading-6 text-muted-foreground">当前卡密含 1 个{settings.allowPaidNumbers ? "可兑换" : "官方免费基础"}号码及 €{Number(settings.initialBalance).toFixed(2)} 初始余额。</p>}
        </div>

        {!selected && <Card className="mb-4 gap-5 rounded-2xl shadow-none">
          <div className="flex gap-1 rounded-xl bg-muted p-1.5" aria-label="选号方式">
            <Button type="button" variant={selectionMode === "direct" ? "secondary" : "ghost"} aria-pressed={selectionMode === "direct"} disabled={searching || submitting} onClick={() => setSelectionMode("direct")} className="h-11 flex-1 rounded-lg">精准输入</Button>
            <Button type="button" variant={selectionMode === "search" ? "secondary" : "ghost"} aria-pressed={selectionMode === "search"} disabled={searching || submitting} onClick={() => setSelectionMode("search")} className="h-11 flex-1 rounded-lg">在线检索</Button>
          </div>
          {selectionMode === "direct" && <form onSubmit={onSelectTarget} className="space-y-3">
            <Label htmlFor="target-number">目标号码（含国家区号）</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="target-number" inputMode="tel" autoComplete="off" value={targetNumber} onChange={e => setTargetNumber(e.target.value)} maxLength={40} placeholder="例如 +372 5123 4567" className="h-12 font-code" />
              <Button type="submit" loading={searching} disabled={!targetNumber.trim() || siteSettings?.redemptionPaused || submitting || checkingOrder || submissionBlocked} className="h-12 shrink-0">核验此号码</Button>
            </div>
            <p className="text-xs text-muted-foreground">支持加号和空格，系统会核验库存与资费；提交订单前不保留号码。</p>
          </form>}
          {selectionMode === "search" && <form onSubmit={doSearch}>
            <Label htmlFor="search">搜索号段或特征码</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                inputMode="numeric"
                autoComplete="off"
                placeholder="留空获取随机号码，或输入 2-15 位数字"
                className="h-12 font-code"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
              />
              <Button type="submit" loading={searching} disabled={siteSettings?.redemptionPaused || submitting || checkingOrder || submissionBlocked} className="shrink-0">
                <Search aria-hidden className="size-4" />
                {searching ? "获取中…" : "检索号码"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              请勿连续快速搜索；如暂时无法检索，可前往官网挑号。
            </p>
          </form>}
          <a href="https://esim.gg/new/number/vanity" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline underline-offset-4">前往 esim.gg 官网挑号 ↗</a>
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
          <Card className="gap-4 rounded-2xl shadow-none">
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
          <Card className="gap-5 rounded-2xl shadow-none">

            <dl className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">待兑换号码</dt>
                <dd className="font-code font-medium">
                  {formatMsisdn(selected.msisdn)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">号码资费</dt>
                <dd className="font-medium">{formatPrice(selected.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">内置初始余额</dt>
                <dd className="font-medium">
                  €{Number(settings?.initialBalance ?? 0.5).toFixed(2)}
                </dd>
              </div>
            </dl>
            <form onSubmit={onConfirm} className="space-y-4">
              <div>
                <Label htmlFor="userid">接收方账号（推荐 UserID）</Label>
                <Input
                  id="userid"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="cm 开头的 UserID 或已注册账户邮箱"
                  className="h-12 font-code"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                />
              </div>

              <UseridGuide />


              {submitting && <Alert kind="info">正在采购号码并转移至你的账户，请保持网络连接，勿重复提交。完成后将自动打开订单页。</Alert>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                  className="h-12 flex-1"
                >
                  返回重选
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={!recipient.trim() || siteSettings?.redemptionPaused || checkingOrder || submissionBlocked}
                  className="h-12 flex-1"
                >
                  {submitting ? "正在采购并转移…" : checkingOrder ? "正在同步订单状态…" : "确认兑换并转移"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!selected && <NumberSelectionGuide />}
      </main>
    </PublicShell>
  );
}
