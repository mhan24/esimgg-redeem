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
        <li>长按账户中的邮箱：电脑按住鼠标左键，手机用单指长按。</li>
        <li>复制显示的 cm 开头的 UserID，粘贴到「接收账户」。</li>
      </ol>

      <p className="mt-3 leading-6">UserID 能准确对应你的账户。尤其使用第三方登录时，建议直接复制，避免邮箱对应多个账户而无法转移。</p>

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
