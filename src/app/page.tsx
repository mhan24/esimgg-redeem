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
      <main className="w-full max-w-md">
        <Card className="w-full gap-6 rounded-xl p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">eSIM 号码兑换</p>
            <h1 className="text-2xl font-semibold tracking-tight">输入卡密</h1>
            <p className="text-sm text-muted-foreground">兑换号码，或查看已有订单。</p>
          </div>
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
              验证并继续
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          </form>

        </Card>
      </main>
    </PublicShell>
  );
}
