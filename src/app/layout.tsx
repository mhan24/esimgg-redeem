import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { TurnstileProvider } from "@/components/TurnstileProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: {
    default: "esim.gg 号码兑换",
    template: "%s | esim.gg 号码兑换",
  },
  description: "输入兑换码，选择号码并转移至你的 esim.gg 账户",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={geist.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <TurnstileProvider>
              {children}
              <Toaster position="top-right" richColors />
            </TurnstileProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
