"use client";


/**
 * 首页: 输入兑换码 (规格 §19/§20; 人机验证 §69)
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Label } from "@/components/ui";
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
      <main className="w-full max-w-lg sm:mt-6">
        <div className="mb-8 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">兑换号码</h1>
          <p className="text-sm leading-7 text-muted-foreground">使用卡密选号，完成后转入你的 esim.gg 账户。</p>
        </div>
          <section aria-label="验证卡密">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="code" className="mb-3 text-sm font-medium">兑换卡密</Label>
              <Input
                id="code"
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="粘贴购买时获得的完整卡密"
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
              className="h-12 w-full px-4"
            >
              {loading ? "正在验证…" : "验证卡密"}
            </Button>
          </form>
          <p id="code-help" className="mt-4 text-xs leading-6 text-muted-foreground">已兑换？输入原卡密查看订单。</p>
          </section>
          <p className="mt-8 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">每张卡密可兑换 1 个号码{settings?.initialBalance ? `，含 €${Number(settings.initialBalance).toFixed(2)} 初始余额` : ""}。</p>
      </main>
    </PublicShell>
  );
}
