export function NumberSelectionGuide() {
  return <details className="mt-6 rounded-lg border border-border bg-card p-4 text-sm leading-6">
    <summary className="cursor-pointer font-medium">免费号码与补差说明</summary>
    <div className="mt-4 space-y-3 text-muted-foreground">
      <p>免费号码指选号附加费为 €0.00，开通费用已包含在卡密中。号源可能暂时售罄，是否可用以实际下单为准。</p>
      <p>「精准输入」仅支持免费基础号码。想选付费或特选号码，请联系客服确认差价并协助办理。</p>
    </div>
  </details>;
}
