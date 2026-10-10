/**
 * UserID 获取指引 (规格: 接收方使用 esim.gg UserID)
 * 包含示例图与 esim.gg 链接 (新窗口打开)
 */
import Image from "next/image";

export function UseridGuide() {
  return (
    <details className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">如何获取 esim.gg UserID？</summary>
      <div className="mt-3">
      <ol className="list-decimal space-y-0.5 pl-4">
        <li>
          打开{" "}
          <a
            href="https://esim.gg/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            esim.gg
          </a>
          ，登录后点击右上角头像
        </li>
        <li>电脑端：将鼠标移到邮箱地址上，按住鼠标左键长按。</li>
        <li>手机端：用单指长按邮箱地址。</li>
        <li>复制显示的 cm 开头的 UserID，并完整粘贴到接收账号输入框。</li>
      </ol>

      <p className="mb-1.5 mt-3 font-semibold text-foreground">
        为什么推荐 UserID？
      </p>
      <ol className="list-decimal space-y-0.5 pl-4">
        <li>UserID 是账号的唯一标识，有助于准确定位接收账号。</li>
        <li>使用第三方登录时，请以实际登录账户显示的 UserID 为准，避免邮箱关联混淆。</li>
      </ol>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        <Image
          src="/userid-guide.jpg"
          alt="获取 UserID 示例：打开账户信息后，电脑按住鼠标左键长按邮箱，手机用单指长按邮箱，复制 cm 开头的 UserID"
          width={762}
          height={330}
          className="h-auto w-full"
          priority={false}
        />
      </div>
      </div>
    </details>
  );
}
