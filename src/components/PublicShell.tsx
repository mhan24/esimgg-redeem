"use client";
import { PublicSiteNotice, PublicDisclaimer, usePublicSiteSettings } from "@/components/PublicSiteNotice";
import type { ReactNode } from "react";
import Link from "next/link";
import { Moon, Sun, Wifi } from "lucide-react";
import { useTheme } from "next-themes";

export function PublicShell({
  children,
  mode = "public",
}: {
  children: ReactNode;
  mode?: "public" | "admin";
}) {
  const settings = usePublicSiteSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const siteName = settings?.siteName ?? "号码兑换";
  return (
    <div className="public-shell relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-background">
      <header className="public-header relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6">
        <Link
          href="/"
          className="inline-flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="public-mark flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wifi aria-hidden className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-48 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {siteName}
            </span>
            {mode === "admin" && <span className="hidden text-xs text-muted-foreground sm:block">管理后台</span>}
          </span>
        </Link>
        {mode === "public" && <nav aria-label="站点链接" className="flex shrink-0 items-center gap-3 text-xs sm:gap-6 sm:text-sm">
          {settings?.purchaseUrl && <a href={settings.purchaseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">购买新卡密</a>}
          {settings?.supportUrl && <a href={settings.supportUrl} target="_blank" rel="noopener noreferrer" aria-label={settings.supportUrl.startsWith("https://t.me/") ? "Telegram 在线客服" : "在线客服"} className="inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">{settings.supportUrl.startsWith("https://t.me/") ? <><span className="sm:hidden">TG 客服</span><span className="hidden sm:inline">Telegram 客服</span></> : "在线客服"}</a>}
          <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={resolvedTheme === "dark" ? "切换浅色外观" : "切换深色外观"} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
            {resolvedTheme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
          </button>
        </nav>}
      </header>

      <div className="public-content relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8 sm:py-20">
        {mode === "public" && <PublicSiteNotice />}
        {children}
      </div>

      <footer className="public-footer relative z-10 mx-auto w-full max-w-6xl border-t border-border/70 bg-background">
        {mode === "admin" ? <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted-foreground sm:px-8">仅限授权管理员访问</p> : <div className="pt-4"><PublicDisclaimer /></div>}
      </footer>
    </div>
  );
}
