"use client";

/**
 * 管理员登录页 (规格 §44; 人机验证 §69)
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { useTurnstile } from "@/components/TurnstileProvider";
import { PublicShell } from "@/components/PublicShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const turnstileEnabled = useTurnstile().enabled;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (turnstileEnabled && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "登录失败");
        if (data.error === "TURNSTILE_FAILED") {
          setTurnstileToken("");
          setTurnstileKey((k) => k + 1);
        }
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell mode="admin">
      <main className="w-full max-w-md">
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LockKeyhole aria-hidden className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">管理员登录</h1>
          <p className="mt-2 text-sm text-muted-foreground">登录以管理兑换码、订单和系统设置。</p>
        </div>
        <Card className="gap-5 rounded-2xl shadow-sm ring-border/90">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              登录后台
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          </form>
        </Card>
      </main>
    </PublicShell>
  );
}
