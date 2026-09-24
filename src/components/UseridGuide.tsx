/**
 * UserID 获取指引 (规格: 接收方使用 esim.gg UserID)
 * 包含示例图与 esim.gg 链接 (新窗口打开)
 */
import Image from "next/image";

export function UseridGuide() {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
      <p className="mb-1.5 font-semibold text-foreground">如何获取 UserID？</p>
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
        <li>长按邮箱</li>
        <li>弹出的 cm 开头的字符串就是 UserID</li>
      </ol>

      <p className="mb-1.5 mt-3 font-semibold text-foreground">
        为什么要用 UserID？
      </p>
      <ol className="list-decimal space-y-0.5 pl-4">
        <li>证明已经注册了账号</li>
        <li>邮箱可能包含多个账号</li>
      </ol>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        <Image
          src="/userid-guide.jpg"
          alt="获取 UserID 示例：点击右上角头像后，在弹出的账户窗口中查看 cm 开头的 UserID"
          width={762}
          height={330}
          className="h-auto w-full"
          priority={false}
        />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        示例：点击右上角头像后，在弹出窗口中查看 cm 开头的 UserID
      </p>

      <div className="mt-2 text-center">
        <a
          href="https://esim.gg/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          前往 esim.gg 获取 UserID →
        </a>
      </div>
    </div>
  );
}
