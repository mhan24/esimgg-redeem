/** Authenticated admin shell. */
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminNav, AdminTopbar } from "@/components/AdminNav";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  return (
    <SidebarProvider defaultOpen className="min-h-svh w-full">
      <AdminNav username={session.username} />
      <SidebarInset className="min-h-svh min-w-0">
        <AdminTopbar />
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 md:px-8 md:py-9">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
