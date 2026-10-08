"use client";

/**
 * 首页: 输入兑换码 (规格 §19/§20; 人机验证 §69)
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
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
      setError("请输入完整的兑换卡密");
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
      setError("网络连接异常，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <main className="grid w-full items-center gap-9 md:grid-cols-[1fr_1.05fr] md:gap-16 lg:gap-24">
        <div className="space-y-5">
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">自助兑换你的 <span className="text-primary">esim.gg 号码</span></h1>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">输入卡密选号，官方线路自动转移至你的 esim.gg 账户。{settings?.initialBalance && <> 含 €{Number(settings.initialBalance).toFixed(2)} 初始余额。</>}</p>
        </div>
        <Card className="w-full gap-7 rounded-2xl p-6 shadow-none sm:p-9">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">卡密验证</h2>
            <p className="text-sm leading-6 text-muted-foreground">新卡密可选号兑换；已兑换卡密可查询订单进度。</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="code">兑换卡密</Label>
              <Input
                id="code"
                name="code"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="ESIM-XXXX-XXXX-XXXX"
                className="h-14 font-code text-base tracking-wide uppercase"
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
              className="h-12 w-full justify-between px-4"
            >
              验证卡密并继续
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          </form>

        </Card>
      </main>
    </PublicShell>
  );
}
