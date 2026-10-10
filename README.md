# esim.gg 号码兑换

基于 [esim.gg Customer API](https://github.com/esimgg/api) 的卡密兑换系统：管理员生成卡密，用户选号、购买并将号码所有权转移到自己的 esim.gg 账户。

这是独立第三方项目。号码、钱包、资费与网络服务由 esim.gg 提供。本项目不处理卡密销售支付；卡密可导入独角数卡等销售平台，也可自行分发。许可证为 [MIT](LICENSE)。

## 用户流程

1. 输入有效卡密；已有订单时直接恢复订单页面。
2. 默认打开「在线检索」，自动获取一次随机可用号码。留空可再次获取，或输入 2–15 位数字检索。
3. 「精准输入」支持完整号码（含国家区号），提交前核验库存与资费。可先在[官方选号页](https://esim.gg/new/number/vanity)确认号码。
4. 填写 esim.gg UserID 或账户邮箱，确认购买和转移。
5. 在订单页查看进度；转移失败时可修改接收账户并重试转移。

推荐使用 UserID，避免邮箱对应多个账户时无法转移。获取方法：登录 esim.gg，点击右上角头像；电脑按住鼠标左键长按邮箱，手机单指长按邮箱，复制显示的 `cm` 开头 UserID。

精准输入目前仅支持免费基础号码。付费或特选号码请通过客服人工补差办理。检索结果不预留号码，库存以提交时为准。

## 后台功能

| 页面 | 功能 |
| --- | --- |
| 概览 | 卡密、订单与实付支出统计，钱包余额和卡密覆盖预警 |
| 卡密 | 批量生成、有效期、备注、启用/禁用、删除、TXT/CSV 导出 |
| 订单 | 筛选与查看、异常购买对账、失败转移恢复 |
| 设置 → 站点 | 名称、暂停兑换与原因、购买链接、客服链接、服务声明 |
| 设置 → 兑换 | 初始余额、免费/付费开关、付费价格上限、号码类型 |
| 设置 → API Key | 多 Key 管理、启用、顺序/随机策略、余额检测 |
| 设置 → 通知 | Telegram Token、目标 Chat ID、通知开关与测试发送 |
| 账号、审计 | 修改登录信息、查看管理操作记录 |

暂停兑换阻止新的检索和购买，已受理订单仍可查询和恢复转移。

### 余额与成本

- 常驻 Node 服务启动后检测启用的 Key；每个 Key 至少间隔 5 分钟检测，慢请求或大量 Key 可能延长周期。购买成功后刷新所用 Key，后台列表每 30 秒更新。
- 钱包成本估算为：`€2.99 基础费 − €0.50 优惠 + 选号附加费 + 初始余额`，支付手续费为 €0.00，不含增值税。免费号码、初始余额 €0.50 时为 **€2.99/张**。
- 实付以购买接口的 `total_price` 为准，优惠、税费和官方价格变化会影响实际成本。
- 覆盖计算使用启用 Key 的余额，扣除有效未使用卡密和处理中卡密的预计成本，给出可增发张数、建议禁用张数或补款金额。
- 钱包不能合并支付；余额未知、异常或超过 10 分钟未更新时，不给出确定的增发建议。同一钱包不要重复添加 Key，以免重复统计。
- 生成数量默认采用建议增发张数，范围 1–1000；建议为 0 时仍保留 1。建议仅为快照估算。

### Telegram 通知

在「设置 → 通知」保存机器人 Token 和目标 Chat ID，发送测试消息后启用。目标支持数字 Chat ID 或 `@频道用户名`，机器人需有发消息权限。

卡密首次变为 `USED`（转移完成）后发送通知，购买或转移失败不发送。消息包含订单 ID、卡密 ID、号码尾号、号码费用、初始余额与 UTC 完成时间，不包含完整卡密、接收邮箱或订单访问令牌。

Token 加密保存。请求最长等待 8 秒，发送失败只记录日志，不影响兑换；当前不自动重试或补发，服务中断时可能丢失通知。

## 技术栈与目录

Next.js 16.3.5（App Router）、React 19、TypeScript、Tailwind CSS 4、shadcn/ui 与 Base UI、Prisma 6、PostgreSQL 17、Vitest、Docker Compose。

```text
src/app/                  页面与 API 路由
src/components/           前台与后台组件
src/services/             卡密、购买、转移、对账、余额监测与通知
src/lib/esim/             官方接口客户端与成本解析
src/lib/balance-coverage.ts  钱包覆盖计算
src/instrumentation.ts    常驻余额检测入口
prisma/                   数据模型、迁移与初始化
scripts/deploy-cleanup.sh 部署成功后的服务器清理
tests/                    单元与数据库集成测试
Dockerfile                Linux 镜像构建
docker-entrypoint.sh      迁移、初始化与启动
```

## 环境配置

复制 `.env.example` 为 `.env`。真实 `.env`、`.env.deploy` 不应提交到仓库。

| 变量 | 用途 |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose 数据库配置，设置强密码 |
| `DATABASE_URL` | 本地开发或数据库工具使用的连接串；Compose 为应用自动生成 |
| `APP_URL` | 外部访问地址，需与域名一致 |
| `SESSION_SECRET` | 随机会话签名密钥 |
| `APP_ENCRYPTION_KEY` | 32 字节加密主密钥，推荐 64 位 hex；用于 API Key 与 Telegram Token |
| `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD` | 首次创建管理员；密码至少 8 位，已有管理员不会被启动脚本覆盖 |
| `ESIM_API_BASE_URL` | 默认 `https://api.esim.gg/api` |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare 人机验证；两项均留空可关闭 |

```bash
cp .env.example .env
openssl rand -base64 48   # SESSION_SECRET
openssl rand -hex 32      # APP_ENCRYPTION_KEY
```

API Key 和 Telegram Token 在后台配置，不放入环境变量。请备份并保留加密主密钥，否则无法解密已有配置。

## 本地开发

需要 Node.js 22 和 PostgreSQL。开发数据库应与生产分离。

```bash
npm ci
# 在 .env 设置 DATABASE_URL、APP_URL=http://localhost:3000 及上述密钥
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

入口：`/` 兑换，`/admin` 管理，`/api/health` 检查服务与数据库。

```bash
npm run lint
npm run typecheck
npm run build
# 修改模型后生成迁移，仅在开发数据库执行
npx prisma migrate dev --name describe_change
```

## 部署

### 服务器构建

需要 Docker 与 Compose v2。在服务器准备源码和 `.env`：

```bash
docker compose up -d --build
docker compose logs -f app
curl -fsS http://127.0.0.1:3100/api/health
```

入口脚本自动迁移和初始化。应用仅绑定 `127.0.0.1:3100`，需反向代理提供 HTTPS，例如 Caddy：

```caddy
your-domain.example {
    reverse_proxy 127.0.0.1:3100
}
```

### 本地构建，服务器加载镜像

本地需要 Docker。Apple 芯片 Mac 可使用支持 amd64 的 Colima/Rosetta 环境；目标架构必须与服务器一致，以下用于 Linux x86_64。

本地执行：

```bash
docker buildx build --platform linux/amd64 --load -t esimgg-app:local-release .
docker image inspect esimgg-app:local-release --format '{{.Os}}/{{.Architecture}}'
# 在 bash/zsh 中启用管道错误检查
set -o pipefail
docker save esimgg-app:local-release | gzip > esimgg-image.tar.gz
scp -P SSH_PORT esimgg-image.tar.gz USER@HOST:/tmp/esimgg-image.tar.gz
```

服务器在项目目录执行。切换前备份数据库、源码和当前镜像；同步新版源码、迁移与清理脚本，保留服务器 `.env`：

```bash
docker tag esimgg-app:latest "esimgg-app:backup-$(date +%Y%m%d-%H%M%S)"
set -o pipefail
gzip -dc /tmp/esimgg-image.tar.gz | docker load
docker tag esimgg-app:local-release esimgg-app:latest
docker compose up -d --no-deps --no-build app
docker compose logs --tail=50 app
curl -fsS http://127.0.0.1:3100/api/health
```

使用 `--no-build` 避免服务器再次编译。确认外部站点正常后再清理。

### 备份、清理与回滚

```bash
# 在项目目录执行数据库逻辑备份
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > database.sql
# 恢复（会写入目标数据库）
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database.sql
# 新版健康后清理
sh scripts/deploy-cleanup.sh
```

清理脚本针对项目 `/home/esimgg`、备份 `/home/esimgg-backups/YYYYMMDD-HHMMSS`。部署到其他路径时先修改脚本。

脚本检查健康，保留最新一份回滚镜像和源码/数据库备份，删除旧备份、闲置构建缓存、上传包及未被运行容器挂载的宿主机 `node_modules` / `.next`，不删除数据库卷。Docker 闲置镜像与构建缓存清理作用于整台主机，共用构建主机需留意此范围。

回滚时重新标记保留镜像并用 `--no-build` 启动。数据库迁移不会随镜像自动回滚，不兼容迁移需单独评估数据库恢复。

## 订单恢复与安全设计

```text
PENDING → PURCHASING → PURCHASED → TRANSFERRING → COMPLETED
PURCHASING → PURCHASE_UNCERTAIN（结果未知，需对账）
PURCHASING → FAILED（明确失败，释放卡密）
TRANSFERRING → TRANSFER_FAILED（保留已购号码，仅重试转移）
```

- 原子锁定卡密，防止同一卡密并发购买。
- 购买结果未知先对账，不自动重复购买；转移失败不重新购号。
- 服务端检索会话核验号码价格，会话有效期 5 分钟。
- 官方请求经服务端，Key 加密入库，管理员密码使用 bcrypt。
- 卡密验证、检索和后台登录限流；检索间隔 3 秒，每卡密每分钟最多 10 次。
- 会话使用 HttpOnly Cookie，写入接口校验来源；配置 Turnstile 后覆盖卡密验证和管理员登录。
- 余额检测依赖常驻 Node 进程，短生命周期无服务器部署不能保证定期执行。

## 测试

`tests/setup.ts` 每个测试前执行 `TRUNCATE … CASCADE` 清空数据。**只能使用独立测试数据库，不能指向生产数据库。**

```bash
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5433/esimgg_test?schema=public'
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
```

测试涉及卡密并发、价格过滤、购买对账、转移恢复、成本解析和安全工具等，不代表官方 API 或生产环境始终可用。
