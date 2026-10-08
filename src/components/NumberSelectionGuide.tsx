export function NumberSelectionGuide({
  supportUrl, initialBalance, allowPaidNumbers,
}: { supportUrl?: string; initialBalance?: string; allowPaidNumbers?: boolean }) {
  return <details className="mt-6 rounded-lg border border-border bg-card p-4 text-sm leading-6">
    <summary className="cursor-pointer font-medium">选号须知与办理指引</summary>
    <div className="mt-4 space-y-4 text-muted-foreground">
      <ol className="list-decimal space-y-3 pl-5">
        <li><h3 className="font-semibold text-foreground">推荐先在官网挑号</h3><p>前往 esim.gg 官网确认心仪号码，复制后返回本站使用「精准输入」。请避免连续快速搜索；核验成功不代表号码已预留，以订单结果为准。</p></li>
        <li><h3 className="font-semibold text-foreground">免费号码库存</h3><p>免费号源可能暂时缺货。检索为空也可能是没有符合条件的号码，可更换数字或查看官网最新库存。</p></li>
        <li><h3 className="font-semibold text-foreground">卡密兑换权益</h3><p>卡密用于开通并转移 1 个{allowPaidNumbers ? "当前可兑换范围内的" : "官方基础（号码标价 €0.00）"}号码{initialBalance && <>，含 €{Number(initialBalance).toFixed(2)} 初始余额</>}。免费指号码标价，开通费用由卡密涵盖。</p></li>
        <li><h3 className="font-semibold text-foreground">付费号码办理</h3><p>精准输入通道仅支持免费基础号码。如需付费或特选号码，请复制号码联系客服确认差价，由客服协助开通并转移。</p></li>
      </ol>
      <div className="space-y-2 rounded-lg bg-muted/50 p-4">
        <h3 className="font-semibold text-foreground">推荐选号流程</h3>
        <p>官网挑号 → 复制号码 → 本站粘贴并核验 → 确认接收账号并提交</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          <a href="https://esim.gg" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">前往 esim.gg 官网挑号</a>
          {supportUrl && <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">{supportUrl.startsWith("https://t.me/") ? "联系 Telegram 客服" : "联系在线客服"}</a>}
        </div>
      </div>
    </div>
  </details>;
}
