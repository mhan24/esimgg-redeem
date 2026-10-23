"use client";


/**
 * 首页: 输入兑换码 (规格 §19/§20; 人机验证 §69)
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Alert, Button, Input, Label } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Turnstile } from "@/components/Turnstile";
import { useTurnstile } from "@/components/TurnstileProvider";
import { PublicShell } from "@/components/PublicShell";
import { usePublicSiteSettings } from "@/components/PublicSiteNotice";

interface VerifyResponse {
  kind: "READY" | "RESUME" | "COMPLETED";
  order?: { token: string };
  error?: string;
}

export default function HomePage() {
  const router = useRouter();
  const settings = usePublicSiteSettings();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  // token 一次性: 验证失败后自增 key 重置 widget 以获取新 token
  const [turnstileKey, setTurnstileKey] = useState(0);
  const { enabled: turnstileEnabled } = useTurnstile();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("请输入购买时获得的完整卡密。");
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setError("请先完成人机安全验证");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/redeem/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = (await res.json()) as VerifyResponse & { message?: string };
      if (!res.ok) {
        setError(data.message ?? "卡密无效或已失效，请检查输入内容或联系售卡客服");
        if (data.error === "TURNSTILE_FAILED") {
          // token 已消耗, 重置 widget
          setTurnstileToken("");
          setTurnstileKey((k) => k + 1);
        }
        return;
      }
      if (data.order?.token) {
        router.push(`/order/${data.order.token}`);
      } else {
        router.push("/redeem");
      }
    } catch {
      setError("暂时无法连接，请检查网络后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <main className="w-full max-w-4xl">
        <div className="mb-8 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">兑换你的 esim.gg 号码</h1>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">选好号码，转入你的 esim.gg 账户。</p>
        </div>
        <Card className="grid gap-0 overflow-hidden rounded-xl border border-border p-0 ring-0 md:grid-cols-[1.45fr_1fr]">
          <section className="p-6 sm:p-8 lg:p-10" aria-label="验证卡密">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="code" className="mb-4 text-base font-semibold">卡密</Label>
              <Input
                id="code"
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="ESIM-XXXX-XXXX-XXXX"
                className="h-12 font-code text-sm tracking-wide uppercase"
                value={code}
                aria-invalid={!!error}
                aria-describedby={error ? "code-error" : "code-help"}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            {error && <div id="code-error" role="alert"><Alert kind="error">{error}</Alert></div>}
            <Turnstile
              key={turnstileKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              className="flex justify-center"
            />
            <Button
              type="submit"
              loading={loading}
              disabled={turnstileEnabled && !turnstileToken}
              className="h-12 w-full justify-between px-4"
            >
              验证并继续
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          </form>
          <p id="code-help" className="mt-5 text-xs leading-6 text-muted-foreground">已兑换的卡密也可在此查看订单。</p>
          </section>
          <aside className="border-t border-border bg-muted/40 p-6 sm:p-8 md:border-t-0 md:border-l lg:p-10" aria-label="兑换内容">
            <h2 className="mb-6 text-sm font-medium">兑换内容</h2>
            <dl className="space-y-5 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">esim.gg 号码</dt><dd className="font-medium">1 个</dd></div>
              {settings?.initialBalance && <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">初始余额</dt><dd className="font-code font-medium">€{Number(settings.initialBalance).toFixed(2)}</dd></div>}
            </dl>
          </aside>
        </Card>
      </main>
    </PublicShell>
  );
}
