import type { ReactNode } from "react";
import { Check, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Card as ShadcnCard } from "@/components/ui/card";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Label as ShadcnLabel } from "@/components/ui/label";
import {
  Alert as ShadcnAlert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type ButtonProps = Omit<React.ComponentProps<typeof ShadcnButton>, "variant"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  loading?: boolean;
};

export function Button({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "default",
    secondary: "outline",
    danger: "destructive",
    ghost: "ghost",
    outline: "outline",
  } as const;

  return (
    <ShadcnButton
      {...props}
      variant={variants[variant]}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn("min-h-9 px-3", className)}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </ShadcnButton>
  );
}

export function Card({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnCard>) {
  return (
    <ShadcnCard
      {...props}
      className={cn(
        "w-full rounded-xl bg-card px-5 py-5 shadow-xs ring-1 ring-border/80 sm:px-6 sm:py-6",
        className,
      )}
    />
  );
}

export function Input({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnInput>) {
  return (
    <ShadcnInput
      {...props}
      className={cn("h-10 rounded-lg bg-background px-3", className)}
    />
  );
}

export function Label({
  children,
  className,
  ...props
}: React.ComponentProps<typeof ShadcnLabel>) {
  return (
    <ShadcnLabel
      {...props}
      className={cn("mb-2 text-foreground", className)}
    >
      {children}
    </ShadcnLabel>
  );
}

export function Alert({
  kind = "info",
  title,
  children,
  className,
}: {
  kind?: "info" | "error" | "success" | "warning";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const kinds = {
    info: "border-info/20 bg-info/5 text-info-foreground",
    error: "border-destructive/20 bg-destructive/5 text-destructive",
    success: "border-success/20 bg-success/5 text-success-foreground",
    warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  };

  return (
    <ShadcnAlert
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      variant={kind === "error" ? "destructive" : "default"}
      className={cn("rounded-lg px-3.5 py-3", kinds[kind], className)}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && (
        <AlertDescription className="text-current/90">
          {children}
        </AlertDescription>
      )}
    </ShadcnAlert>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden className="size-4 animate-spin text-primary motion-reduce:animate-none" />
      <span>{label ?? "处理中…"}</span>
    </div>
  );
}

/** Steps used by the public redeem flow. */
export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["兑换码", "选号", "确认", "完成"];

  return (
    <ol
      aria-label="兑换流程"
      className="relative mb-7 grid grid-cols-4 before:absolute before:left-[12.5%] before:right-[12.5%] before:top-3.5 before:h-px before:bg-border"
    >
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;

        return (
          <li
            key={label}
            className="relative z-10 flex flex-col items-center gap-2 text-center"
          >
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-background text-primary ring-4 ring-primary/10",
                !done && !active && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check aria-hidden className="size-3.5" /> : step}
            </span>
            <span
              className={cn(
                "text-xs",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function formatMsisdn(msisdn: string): string {
  if (msisdn.length <= 6) return msisdn;
  return `+${msisdn.slice(0, 3)} ${msisdn.slice(3, 7)} ${msisdn.slice(7)}`;
}

export function formatPrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  return n === 0 ? "免费" : `€${n.toFixed(2)}`;
}

const statusLabels: Record<string, string> = {
  UNUSED: "未使用",
  LOCKED: "已锁定",
  PURCHASED: "已购买",
  USED: "已使用",
  DISABLED: "已禁用",
  PENDING: "待处理",
  PURCHASING: "购买中",
  PURCHASE_UNCERTAIN: "待核实",
  TRANSFERRING: "转移中",
  TRANSFER_FAILED: "转移失败",
  COMPLETED: "已完成",
  FAILED: "失败",
};

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    UNUSED: "bg-muted text-muted-foreground",
    LOCKED: "bg-warning/10 text-warning-foreground",
    PURCHASED: "bg-info/10 text-info-foreground",
    USED: "bg-success/10 text-success-foreground",
    DISABLED: "bg-destructive/10 text-destructive",
    PENDING: "bg-muted text-muted-foreground",
    PURCHASING: "bg-warning/10 text-warning-foreground",
    PURCHASE_UNCERTAIN: "bg-warning/10 text-warning-foreground",
    TRANSFERRING: "bg-info/10 text-info-foreground",
    TRANSFER_FAILED: "bg-destructive/10 text-destructive",
    COMPLETED: "bg-success/10 text-success-foreground",
    FAILED: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      title={status}
      className={cn("border-transparent font-medium", variants[status] ?? "bg-muted text-muted-foreground")}
    >
      {statusLabels[status] ?? status}
    </Badge>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox aria-hidden className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
