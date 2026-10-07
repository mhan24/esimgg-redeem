"use client";
import { PublicSiteNotice, PublicDisclaimer, usePublicSiteSettings } from "@/components/PublicSiteNotice";
import type { ReactNode } from "react";
import Link from "next/link";
import { Wifi } from "lucide-react";

export function PublicShell({
  children,
  mode = "public",
}: {
  children: ReactNode;
  mode?: "public" | "admin";
}) {
  const settings = usePublicSiteSettings();
  const siteName = settings?.siteName ?? "号码兑换";
  return (
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-background">
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wifi aria-hidden className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-48 truncate text-sm font-semibold tracking-tight text-foreground">
              {siteName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {mode === "admin" ? "管理后台" : "号码兑换"}
            </span>
          </span>
        </Link>
        {mode === "public" && <nav aria-label="站点链接" className="flex shrink-0 items-center gap-5 text-sm">
          {settings?.purchaseUrl && <a href={settings.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">购买卡密</a>}
          {settings?.supportUrl && <a href={settings.supportUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">客服</a>}
        </nav>}
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-12 pt-8 sm:px-6 sm:py-16">
        {mode === "public" && <PublicSiteNotice />}
        {children}
      </div>

      <footer className="relative z-10 border-t border-border/70 bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            {mode === "admin"
              ? "仅限授权管理员访问"
              : "兑换码与订单链接仅供本人使用"}
          </span>
          <span>{siteName} · {mode === "admin" ? "管理后台" : "号码兑换"}</span>
        </div>
        {mode === "public" && <PublicDisclaimer />}
      </footer>
    </div>
  );
}
