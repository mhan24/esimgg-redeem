"use client";

/**
 * 首页: 输入兑换码 (规格 §19/§20; 人机验证 §69)
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, Button, Card, Input, Label, Steps } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { useTurnstile } from "@/components/TurnstileProvider";
import { PublicShell } from "@/components/PublicShell";

interface VerifyResponse {
  kind: "READY" | "RESUME" | "COMPLETED";
  order?: { token: string };
  error?: string;
}

export default function HomePage() {
  const router = useRouter();
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
      setError("请输入兑换码");
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setError("请先完成人机验证");
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
        setError(data.message ?? "验证失败，请检查兑换码");
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
      setError("网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <main className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-14">
        <section className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <Sparkles aria-hidden className="size-3.5" />
            为你的下一张 eSIM 挑个号码
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.8rem]">
            选一个喜欢的号码，
            <span className="block text-primary">几步完成兑换。</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground lg:mx-0 sm:text-base">
            输入兑换码，搜索可用号码，再把号码转移到你的 esim.gg 账户。
            整个流程会显示清晰的价格与订单状态。
          </p>
          <div className="mt-7 grid gap-3 text-left sm:grid-cols-2 lg:max-w-lg">
            <div className="flex gap-3 rounded-xl border border-border/70 bg-card/75 p-4 shadow-xs">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Check aria-hidden className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">先看号码和价格</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">确认后才会提交购买</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-border/70 bg-card/75 p-4 shadow-xs">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck aria-hidden className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">安全转移到账号</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">无需在页面填写密码</p>
              </div>
            </div>
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md gap-5 rounded-2xl p-5 shadow-md ring-border/90 sm:p-7">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                开始兑换
              </p>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                第 1 步 / 共 4 步
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">输入兑换码</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">兑换码可在购买渠道获取。</p>
          </div>

          <Steps current={1} />
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">兑换码</Label>
              <Input
                id="code"
                name="code"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="ESIM-XXXX-XXXX-XXXX"
                className="h-12 text-center font-code text-base tracking-widest uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            {error && <Alert kind="error">{error}</Alert>}
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
              className="w-full"
            >
              继续选号
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          </form>
          <p className="border-t border-border/70 pt-4 text-center text-xs leading-5 text-muted-foreground">
            遇到问题请联系你的购买渠道或管理员。
          </p>
        </Card>
      </main>
    </PublicShell>
  );
}
