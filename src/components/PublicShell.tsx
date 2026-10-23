"use client";
import { PublicSiteNotice, PublicDisclaimer, usePublicSiteSettings } from "@/components/PublicSiteNotice";
import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function PublicShell({
  children,
  mode = "public",
}: {
  children: ReactNode;
  mode?: "public" | "admin";
}) {
  const settings = usePublicSiteSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeToClient, clientSnapshot, serverSnapshot);
  const dark = mounted && resolvedTheme === "dark";
  const siteName = settings?.siteName ?? "号码兑换";
  return (
    <div className="public-shell flex min-h-dvh flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
      <div className="mx-auto flex min-h-18 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="min-w-0">
            <span className="block max-w-44 truncate text-sm font-semibold tracking-tight text-foreground sm:max-w-64">
              {siteName}
            </span>
            {mode === "admin" && <span className="hidden text-xs text-muted-foreground sm:block">管理后台</span>}
          </span>
        </Link>
        {mode === "public" && <nav aria-label="站点链接" className="flex shrink-0 items-center gap-3 text-xs sm:gap-6 sm:text-sm">
          {settings?.purchaseUrl && <a href={settings.purchaseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">购买卡密</a>}
          {settings?.supportUrl && <a href={settings.supportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">联系客服</a>}
          <Button type="button" variant="ghost" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "切换浅色外观" : "切换深色外观"} className="h-10 text-xs text-muted-foreground">
            {dark ? "浅色" : "深色"}
          </Button>
        </nav>}
      </div></header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 py-10 sm:px-8 sm:py-16">
        {mode === "public" && <PublicSiteNotice />}
        {children}
      </div>

      <footer className="mx-auto w-full max-w-6xl border-t border-border">
        {mode === "admin" ? <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted-foreground sm:px-8">仅限授权管理员访问</p> : <div className="pt-4"><PublicDisclaimer /></div>}
      </footer>
    </div>
  );
}
