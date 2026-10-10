"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, Input, Label, Spinner } from "@/components/ui";
import { Switch } from "@/components/ui/switch";

export function TelegramSettings() {
  const [enabled, setEnabled] = useState(false);
  const [chatId, setChatId] = useState("");
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/notifications", { cache: "no-store" }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "加载通知配置失败");
      if (active) {
        setEnabled(data.enabled); setChatId(data.chatId); setConfigured(data.tokenConfigured); setReady(true);
      }
    }).catch(() => { if (active) setError("无法加载通知配置，请刷新页面重试。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(test: boolean) {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/admin/notifications${test ? "/test" : ""}`, {
        method: test ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(test ? {} : { body: JSON.stringify({ enabled, chatId, token }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "操作失败");
      if (!test) { setConfigured(configured || !!token.trim()); setToken(""); setDirty(false); }
      setNotice(test ? "测试通知已发送，请查看目标频道或群组。" : "通知设置已保存。");
    } catch (err) { setError(err instanceof Error ? err.message : "网络错误，请重试。"); }
    finally { setBusy(false); }
  }

  return <Card>
    <h2 className="mb-3 text-sm font-semibold text-foreground">Telegram 通知</h2>
    <p className="mb-4 text-sm text-muted-foreground">卡密兑换并完成转移后发送通知。</p>
    {loading ? <Spinner label="加载通知配置…" /> : <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(false); }}>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <fieldset disabled={busy || !ready} className="space-y-4">
        <label className="flex items-center gap-3 text-sm"><Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); setDirty(true); }} aria-label="启用 Telegram 通知" />启用通知</label>
        <div>
          <Label htmlFor="telegram-token">机器人 Token</Label>
          <Input id="telegram-token" type="password" autoComplete="new-password" value={token} onChange={(e) => { setToken(e.target.value); setDirty(true); }} placeholder={configured ? "已配置，留空保留原 Token" : "从 @BotFather 获取"} />
          <p className="mt-1 text-xs text-muted-foreground">修改机器人时填写新的 Token。</p>
        </div>
        <div>
          <Label htmlFor="telegram-chat">目标频道或群组 Chat ID</Label>
          <Input id="telegram-chat" value={chatId} onChange={(e) => { setChatId(e.target.value); setDirty(true); }} placeholder="-1001234567890 或 @channel_name" />
          <p className="mt-1 text-xs text-muted-foreground">将机器人加入目标群组或频道；频道需要授予机器人发消息权限。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={busy}>保存通知设置</Button>
          <Button type="button" disabled={dirty || !configured || !chatId.trim()} onClick={() => void submit(true)}>发送测试通知</Button>
        </div>
        {dirty && <p className="text-xs text-muted-foreground">请先保存修改，再发送测试通知。</p>}
      </fieldset>
    </form>}
  </Card>;
}
