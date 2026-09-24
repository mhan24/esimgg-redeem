import type { ReactNode } from "react";
import Link from "next/link";
import { LockKeyhole, Wifi } from "lucide-react";

export function PublicShell({
  children,
  mode = "public",
}: {
  children: ReactNode;
  mode?: "public" | "admin";
}) {
  return (
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wifi aria-hidden className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-foreground">
              esim.gg
            </span>
            <span className="block text-xs text-muted-foreground">
              {mode === "admin" ? "管理后台" : "号码兑换"}
            </span>
          </span>
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
          <LockKeyhole aria-hidden className="size-3.5 text-primary" />
          {mode === "admin" ? "授权管理员" : "安全兑换"}
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pb-8 pt-4 sm:px-6 sm:pb-12">
        {children}
      </div>

      <footer className="relative z-10 border-t border-border/70 bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            {mode === "admin"
              ? "仅限授权管理员访问"
              : "兑换码与订单链接仅供本人使用"}
          </span>
          <span>esim.gg · {mode === "admin" ? "管理后台" : "号码兑换"}</span>
        </div>
      </footer>
    </div>
  );
}
