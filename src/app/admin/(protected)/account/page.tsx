"use client";

/**
 * 账号设置页 (规格 §70): 修改用户名 / 密码
 */
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, PageHeading, Spinner } from "@/components/ui";

export default function AdminAccountPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 修改用户名
  const [currentPwdForName, setCurrentPwdForName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [savingName, setSavingName] = useState(false);

  // 修改密码
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // 进入页面: 拉取当前账号信息
  useEffect(() => {
    fetch("/api/admin/profile", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? "加载失败");
          return;
        }
        setUsername(json.username ?? "");
        setError(null);
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [router]);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  async function onSubmitUsername(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!currentPwdForName) {
      setError("请输入当前密码");
      return;
    }
    if (!newUsername.trim()) {
      setError("请输入新用户名");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPwdForName,
          newUsername: newUsername.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "修改失败");
        return;
      }
      setUsername(json.username ?? newUsername.trim());
      setCurrentPwdForName("");
      setNewUsername("");
      setNotice("用户名已修改");
      router.refresh(); // 同步导航栏显示
    } catch {
      setError("网络错误");
    } finally {
      setSavingName(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!currentPwd) {
      setError("请输入当前密码");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? "修改失败");
        return;
      }
      setCurrentPwd("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("密码已修改，下次登录请使用新密码");
    } catch {
      setError("网络错误");
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading && !username) {
    return (
      <Card>
        <Spinner label="加载中…" />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="账号设置"
        description="更新管理员用户名和密码。"
      />
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">当前账号</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">用户名</dt>
            <dd className="font-code font-medium">{username}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          修改用户名或密码都需要验证当前密码；连续 5 次输错当前密码将被限流 10 分钟。
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">修改用户名</h2>
        <form onSubmit={onSubmitUsername} className="space-y-4">
          <div>
            <Label htmlFor="current-pwd-name">当前密码</Label>
            <Input
              id="current-pwd-name"
              type="password"
              autoComplete="current-password"
              value={currentPwdForName}
              onChange={(e) => setCurrentPwdForName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-username">新用户名</Label>
            <Input
              id="new-username"
              autoComplete="off"
              placeholder="3-32 位字母、数字、下划线或连字符"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.trim())}
            />
          </div>
          <Button
            type="submit"
            loading={savingName}
            disabled={!currentPwdForName || !newUsername.trim()}
          >
            修改用户名
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">修改密码</h2>
        <form onSubmit={onSubmitPassword} className="space-y-4">
          <div>
            <Label htmlFor="current-pwd">当前密码</Label>
            <Input
              id="current-pwd"
              type="password"
              autoComplete="current-password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-pwd">新密码</Label>
            <Input
              id="new-pwd"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm-pwd">确认新密码</Label>
            <Input
              id="confirm-pwd"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            loading={savingPwd}
            disabled={!currentPwd || !newPassword || !confirmPassword}
          >
            修改密码
          </Button>
        </form>
      </Card>
    </div>
  );
}
