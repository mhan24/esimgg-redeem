"use client";
import { BalanceCoverage } from "@/components/BalanceCoverage";

/**
 * Dashboard (规格 §5)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { PageHeading } from "@/components/ui";
import { RefreshCw } from "lucide-react";

interface DashboardData {
  wallet: { currency: string; balance: number } | null;
  walletError: string | null;
  codes: {
    total: number;
    unused: number;
    locked: number;
    purchased: number;
    used: number;
    disabled: number;
  };
  orders: {
    total: number;
    today: number;
    purchaseUncertain: number;
    transferFailed: number;
    completed: number;
  };
  amounts: {
    numberPurchase: string;
    initialBalanceSpend: string;
    /** 官方实付成本合计 (规格 §71) */
    actualCost?: string;
    actualCostOrders?: number;
    /** 预估成本合计 (号码价格 + 初始余额) */
    estimatedCost?: string;
  };
  /** API Key 概览与低余额预警 (规格 §71) */
  keys?: {
    id: string;
    name: string;
    maskedKey: string;
    enabled: boolean;
    lastBalance: string | null;
    lowBalance: boolean;
  }[];
  keyStrategy?: string;
  keyLowBalanceThreshold?: string;
  lowBalanceKeys?: { id: string; name: string; lastBalance: string | null }[];
}
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.message ?? "加载失败");
      return;
    }
    setData(json);
    setError(null);
  }, [router]);

  // 进入页面: 拉取数据 (内联 fetch: 避免 effect 内调用含 setState 的函数)
  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
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
        setData(json);
        setError(null);
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading && !data) {
    return (
      <Card>
        <Spinner label="加载中…" />
      </Card>
    );
  }
  if (error && !data) {
    return <Alert kind="error">{error}</Alert>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="运营概览"
        action={
          <Button variant="secondary" onClick={() => { void reload(); }} loading={loading}>
            <RefreshCw aria-hidden className="size-4" />
            刷新数据
          </Button>
        }
      />

      <BalanceCoverage />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">卡密</h2>
        <div className="admin-stats-grid grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="总数" value={data.codes.total} />
          <Stat label="未使用" value={data.codes.unused} />
          <Stat label="已锁定" value={data.codes.locked} />
          <Stat label="已购买" value={data.codes.purchased} />
          <Stat label="已使用" value={data.codes.used} />
          <Stat label="已禁用" value={data.codes.disabled} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">订单</h2>
        <div className="admin-stats-grid grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="订单总数" value={data.orders.total} />
          <Stat label="今日订单" value={data.orders.today} />
          <Stat label="转移成功" value={data.orders.completed} />
          <Stat label="转移失败" value={data.orders.transferFailed} />
          <Stat label="购买待核实" value={data.orders.purchaseUncertain} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">支出</h2>
        <div className="admin-stats-grid grid grid-cols-2 gap-0 lg:grid-cols-4">
          <Stat
            label="官方实付成本"
            value={`€${Number(data.amounts.actualCost ?? 0).toFixed(2)}`}
            hint={`${data.amounts.actualCostOrders ?? 0} 笔已记录`}
          />
          <Stat
            label="预估成本合计"
            value={`€${Number(data.amounts.estimatedCost ?? 0).toFixed(2)}`}
            hint="按当前优惠估算"
          />
          <Stat
            label="号码购买金额"
            value={`€${Number(data.amounts.numberPurchase).toFixed(2)}`}
          />
          <Stat
            label="初始余额支出"
            value={`€${Number(data.amounts.initialBalanceSpend).toFixed(2)}`}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          实付以官方结算为准，优惠和税费可能造成差异。
        </p>
      </section>

      {data.lowBalanceKeys && data.lowBalanceKeys.length > 0 && (
        <Alert kind="warning">
          <p className="font-medium">API Key 余额不足预警</p>
          <ul className="mt-1 space-y-0.5">
            {data.lowBalanceKeys.map((k) => (
              <li key={k.id}>
                {k.name}：余额 €{Number(k.lastBalance ?? 0).toFixed(2)}
                （低于阈值 €{Number(data.keyLowBalanceThreshold ?? 2.99).toFixed(2)}）
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className="mt-1 inline-block underline">
            前往 API Key 管理
          </Link>
        </Alert>
      )}

      {(data.orders.purchaseUncertain > 0 || data.orders.transferFailed > 0) && (
        <Alert kind="warning">
          有 {data.orders.purchaseUncertain} 个购买待核实 /{" "}
          {data.orders.transferFailed} 个转移失败订单需要处理，
          <Link href="/admin/exceptions" className="ml-1 underline">
            前往异常订单
          </Link>
        </Alert>
      )}
    </div>
  );
}
