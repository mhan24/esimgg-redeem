import { estimateWalletCost } from "@/lib/esim/cost";

export function WalletCostEstimate({ numberPrice, initialBalance }: { numberPrice: string; initialBalance: string }) {
  const cost = estimateWalletCost(numberPrice, initialBalance);
  if (!cost) return null;
  return <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
    <p className="mb-2 font-medium text-foreground">钱包购买成本估算（按当前优惠）</p>
    <div className="flex justify-between"><span>eSIM 基础费用</span><span>€{cost.basePrice}</span></div>
    <div className="flex justify-between"><span>优惠券折扣</span><span>−€{cost.couponDiscount}</span></div>
    <div className="flex justify-between"><span>选号附加费用</span><span>€{cost.numberPrice}</span></div>
    <div className="flex justify-between"><span>初始余额</span><span>€{cost.initialBalance}</span></div>
    <div className="flex justify-between"><span>支付手续费（钱包支付）</span><span>€{cost.paymentFee}</span></div>
    <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground"><span>预估合计（不含增值税）</span><span>€{cost.total}</span></div>
    <p className="pt-1">按基础费 €2.99、优惠券 €0.50 估算；优惠和税费以账户实际结算为准，统计使用 API 返回的实付金额。</p>
  </div>;
}
