import { Card } from '@/components/ui';
export function NumberSelectionGuide({ supportUrl }: { supportUrl?: string }) {
  return <Card className="mb-4 gap-4 text-sm leading-7">
    <h2 className="text-base font-semibold">选号指引与下单须知</h2>
    <p className="text-muted-foreground">尊敬的用户：为确保您的业务办理顺畅，请在选号与提交订单前知悉以下说明：</p>
    <ol className="list-decimal space-y-3 pl-5">
      <li><h3 className="font-semibold">选号建议与接口限制</h3><p>受官方接口速率与调用频次限制，短时间内连续检索易触发限流报错。<strong>建议您优先前往官方网站挑选并确认心仪号码。</strong></p></li>
      <li><h3 className="font-semibold">号码库存与释放机制</h3><p>若系统检索无可用号码，表明当前批次官方免费号码已售罄，需等待官方下一轮号源补货与释放。</p></li>
      <li><h3 className="font-semibold">卡密面值与兑换范围</h3><p>本平台兑换码（卡密）等效兑换价值为 <strong>2.99 欧元</strong>，系统默认仅支持自动化开通<strong>基础（免费）号码</strong>。</p></li>
      <li><h3 className="font-semibold">付费号码办理流程（补差与人工划转）</h3><p>系统默认未开放付费号码的自动下单通道。<strong>如您心仪付费/特选号码，可联系在线客服补足资费差价，由客服专员人工协助采购并办理号码转移。</strong></p></li>
    </ol>
    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
      <h3 className="font-semibold">推荐下单流程</h3>
      <p className="font-medium">前往官方确认号码 ➔ 复制目标号码 ➔ 返回本页面直接输入并提交订单</p>
      <p className="text-xs text-muted-foreground">如遇付费号码，请直接联系在线客服协助补差与转移。</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        <a href="https://esim.gg" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">前往官方挑选号码</a>
        {supportUrl && <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">联系在线客服</a>}
      </div>
    </div>
  </Card>;
}
