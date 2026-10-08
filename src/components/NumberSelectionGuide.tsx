export function NumberSelectionGuide() {
  return <details className="mt-6 rounded-lg border border-border bg-card p-4 text-sm leading-6">
    <summary className="cursor-pointer font-medium">免费与付费号码说明</summary>
    <div className="mt-4 space-y-3 text-muted-foreground">
      <p>免费指号码标价为 €0.00，开通费用由卡密涵盖。免费号源可能暂时缺货，库存以官网和实际下单结果为准。</p>
      <p>精准输入仅支持免费基础号码。付费或特选号码需联系客服确认差价，由客服协助开通并转移。</p>
    </div>
  </details>;
}
