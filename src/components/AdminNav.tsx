"use client";

import { usePublicSiteSettings } from "@/components/PublicSiteNotice";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CircleAlert,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  ShoppingCart,
  Ticket,
  UserRound,
  Wifi,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";


const NAV = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/codes", label: "卡密管理", icon: Ticket },
  { href: "/admin/orders", label: "订单管理", icon: ShoppingCart },
  { href: "/admin/exceptions", label: "异常订单", icon: CircleAlert },
  { href: "/admin/settings", label: "系统设置", icon: Settings2 },
  { href: "/admin/audit", label: "审计日志", icon: ScrollText },
];

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminNav({ username }: { username: string }) {
  const settings = usePublicSiteSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Wifi aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{settings?.siteName ?? "号码兑换"}</span>
            <span className="mt-0.5 block truncate text-xs text-sidebar-foreground/65">管理控制台</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isCurrent(pathname, item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                    tooltip={item.label}
                    aria-current={active ? "page" : undefined}
                    className={active ? "data-active:bg-sidebar-accent data-active:text-sidebar-primary" : "text-sidebar-foreground/75"}
                  >
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/admin/account" />}
              isActive={isCurrent(pathname, "/admin/account")}
              tooltip="账号设置"
              aria-current={isCurrent(pathname, "/admin/account") ? "page" : undefined}
              className="h-10 text-sidebar-foreground/85"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
                {username.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{username}</span>
              <UserRound aria-hidden className="size-4 text-sidebar-foreground/55" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => void logout()}
              disabled={loggingOut}
              tooltip="退出登录"
              className="text-sidebar-foreground/65 hover:text-sidebar-foreground"
            >
              <LogOut aria-hidden />
              <span>{loggingOut ? "正在退出…" : "退出登录"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-7">
      <SidebarTrigger className="size-9" aria-label="切换导航菜单" />
      <Separator orientation="vertical" className="h-5" />
      <Link href="/" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">打开前台 ↗</Link>
    </header>
  );
}
