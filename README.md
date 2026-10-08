# esim.gg 选号兑换系统

基于 esim.gg Customer API 的号码兑换/选号系统。与独角数卡（Dujiao / Dujiao-Next）通过**卡密**解耦：独角数卡负责销售，本系统负责卡密生成/验证、号码搜索、选号、购买、初始化余额以及 Ownership Transfer。

**许可证：** MIT，详见 [LICENSE](LICENSE)。

## 业务流程

```text
管理员后台生成卡密 -> 导出 -> 导入独角数卡 -> 用户购买获得卡密
-> 进入选号站输入卡密 -> 搜索号码 -> 选择号码 -> 填写 esim.gg UserID
-> 服务器购买号码 -> 初始化余额 -> Ownership Transfer -> 兑换完成
```

## 技术栈

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- PostgreSQL 17 + Prisma ORM
- Docker / Docker Compose 部署
- Vitest 测试（73 项，覆盖并发安全、购买幂等、对账、转移恢复）

## 环境要求

- Docker 24+ 与 Docker Compose v2（推荐部署方式）
- 或 Node.js 22+ 与 PostgreSQL 17（普通部署）

## Docker 部署（推荐）

```bash
# 1. 复制环境变量示例
cp .env.example .env

# 2. 生成随机密钥并填入 .env
openssl rand -base64 48   # -> SESSION_SECRET
openssl rand -hex 32      # -> APP_ENCRYPTION_KEY
# 同时设置 POSTGRES_PASSWORD 与 ADMIN_INITIAL_PASSWORD

# 3. 构建并启动 (app 监听 127.0.0.1:3100, 需自行反向代理)
docker compose up -d --build

# 4. 查看启动日志 (入口会自动执行 migrate deploy 与管理员初始化)
docker compose logs -f app
```

启动后：

| 入口 | 地址 |
|---|---|
| 用户兑换页 | `http://127.0.0.1:3100/` |
| 管理后台 | `http://127.0.0.1:3100/admin` |
| 健康检查 | `http://127.0.0.1:3100/api/health` |

## 反向代理（以 Caddy 为例）

应用仅绑定本机回环地址，请在反向代理中添加站点（TLS 自动签发）：

```caddy
esimgg.setup0.de {
    reverse_proxy 127.0.0.1:3100
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## 普通部署（无 Docker）

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run seed        # 初始化管理员 (ADMIN_INITIAL_USERNAME/PASSWORD)
npm start
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `APP_URL` | 站点外部地址（影响 Cookie Secure 与 CSRF Origin 校验） |
| `SESSION_SECRET` | 会话签名密钥（≥16 位） |
| `APP_ENCRYPTION_KEY` | API Key 加密主密钥（32 字节，64 位 hex 或 base64） |
| `ADMIN_INITIAL_USERNAME` | 首次启动创建的管理员用户名 |
| `ADMIN_INITIAL_PASSWORD` | 首次启动创建的管理员密码（≥8 位，创建后请尽快修改） |
| `ESIM_API_BASE_URL` | esim.gg API 地址，默认 `https://api.esim.gg/api` |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile 站点密钥（公开信息，经 `/api/turnstile/config` 下发浏览器） |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 密钥（仅服务端校验用）；两项留空即关闭人机验证 |

> esim.gg **API Key 不通过环境变量配置**：登录后台 → 系统设置 → esim.gg API Key → 填写 → 测试连接 → 保存。Key 以 AES-256-GCM 加密入库，绝不下发浏览器。

## 数据库 Migration

```bash
# 生产
npx prisma migrate deploy
# 开发（生成新迁移）
npx prisma migrate dev --name <变更说明>
```

## 后台功能

- **仪表盘**：Wallet EUR 余额、卡密/订单统计、购买金额与初始余额支出
- **卡密管理**：批量生成（`ESIM-XXXX-XXXX-XXXX`，CSPRNG）、禁用/启用/删除未使用、TXT/CSV 导出
- **订单管理**：按状态/号码/邮箱/卡密筛选，查看内部 API 响应
- **异常订单**：`PURCHASE_UNCERTAIN`（人工对账）与 `TRANSFER_FAILED`（改邮箱/账户 ID 重试转移）
- **系统设置**：API Key、初始余额、免费/付费号码开关、付费最高价、号码类型
- **账号设置**：修改用户名与密码（需验证当前密码，连续 5 次输错限流 10 分钟，变更写审计日志）
- **审计日志**：API Key 变更、设置变更、卡密生成/禁用、人工重试转移等

## 选号设置

| 设置 | 默认 | 说明 |
|---|---|---|
| `initial_balance` | `0.50` EUR | 购买号码时初始化的余额（`recharge_amount`） |
| `allow_free_numbers` | `true` | 允许免费号码（price = 0） |
| `allow_paid_numbers` | `false` | 允许付费号码 |
| `max_paid_number_price` | `2.00` EUR | 付费号码价格上限 |
| `number_type` | `global` | `global` / `asia` |

> esim.gg 标准最低 `recharge_amount` 为 1.00 EUR，但账户可能存在 account-specific minimum，因此系统不硬编码最低值；API 拒绝时真实错误会记录到订单日志并反馈给管理员。

模式组合：免费 ON / 付费 OFF 只显示免费号码；两者 ON 显示免费 + 价格 ≤ 上限的付费号码；免费 OFF / 付费 ON 只显示 `0 < price ≤ max`；两者 OFF 暂停兑换。

## 独角数卡导入方法

1. 后台 → 卡密管理 → 生成（数量/前缀/有效期/备注）→ 生成
2. 导出 TXT（每行一个卡密）或 CSV（含状态/批次/备注）
3. 独角数卡后台 → 商品 → 卡密管理 → 导入（粘贴或上传）
4. 用户购买后获得卡密，前往选号站完成兑换

## 安全设计

- 所有 esim.gg API 请求经服务端，API Key 永不进入浏览器/日志/前端响应
- 卡密状态机并发安全：`UNUSED → LOCKED` 原子条件更新，一卡密最多一个号码
- 购买超时/不确定响应先 `GET /line/all` 对账，绝不自动重买（避免双倍购买）
- 号码价格来自服务端 `NumberSearchSession`（5 分钟有效），不信任客户端提交
- Transfer 失败仅允许修改 UserID 重试，禁止重新购买
- 限流：卡密验证 10 次失败/10 分钟/IP；搜索 3 秒间隔 + 10 次/分钟；后台登录 5 次/10 分钟
- 人机验证：Cloudflare Turnstile 覆盖兑换码验证与管理员登录（未配置密钥时自动关闭）；siteverify 网络异常时失败关闭
- 管理员密码 bcrypt 哈希；会话 Cookie HttpOnly + Secure + SameSite=Lax；变更请求 Origin 校验
- 账号变更（用户名/密码）必须验证当前密码，用户名与密码原子更新，成功后重签发会话；当前密码连续 5 次错误限流 10 分钟

## 接收方：esim.gg UserID

兑换时用户需提供 **esim.gg UserID**（非邮箱），对应 API 的 `recipient_account_id`。

**获取方式**：登录 esim.gg → 点击右上角头像 → 长按邮箱 → 弹出的 `cm` 开头字符串即为 UserID。

**为什么用 UserID 而不是邮箱**：

1. 证明已经注册了账号；
2. 邮箱可能包含多个账号（同一邮箱对应多个账户时，按邮箱转移会失败）。

## 订单状态

```text
PENDING -> PURCHASING -> PURCHASED -> TRANSFERRING -> COMPLETED
PURCHASING -> PURCHASE_UNCERTAIN  (结果未知且对账未命中, 等待人工处理)
PURCHASING -> FAILED              (明确失败, 卡密释放为 UNUSED)
TRANSFERRING -> TRANSFER_FAILED   (仅允许重试转移)
```

## 测试

```bash
# 需要本地 PostgreSQL (或 docker run postgres) 与测试数据库
npm test
```

覆盖规格要求的全部场景：卡密并发、免费号码保护、最高价格拒绝、购买超时对账继续转移、Transfer 失败不重购、Transfer 重试成功、API Key 不泄露，以及加解密、令牌、限流、模式过滤、错误映射等单元测试。

## 备份

```bash
# 数据库备份 (逻辑备份)
docker exec esimgg-postgres pg_dump -U esimgg esimgg | gzip > esimgg-$(date +%F).sql.gz

# 恢复
gunzip -c esimgg-2026-01-01.sql.gz | docker exec -i esimgg-postgres psql -U esimgg -d esimgg
```

卷备份：`docker run --rm -v esimgg_pgdata:/data -v $PWD:/backup alpine tar czf /backup/pgdata.tgz -C /data .`

## 升级

```bash
git pull
docker compose up -d --build   # 入口自动执行 prisma migrate deploy
docker compose logs -f app
```

## 目录结构

```text
prisma/schema.prisma       数据模型 (Admin/SystemSetting/RedeemCode/Order/NumberSearchSession/AuditLog)
src/lib/esim/              esim.gg API Client (统一封装, definitive/uncertain 错误分类)
src/lib/turnstile.ts        Cloudflare Turnstile 服务端校验 (规格 §69)
src/services/              业务层: 购买状态机 / 转移 / 卡密 / 搜索 / 设置 / 审计
src/app/api/               API 路由 (前台 + /api/admin/*)
src/app/                   页面 (兑换流程四步 + 后台)
tests/                     单元 + 集成测试
```

## Telegram 卡密使用通知

后台「系统设置 → Telegram 卡密使用通知」中配置机器人 Token、目标 Chat ID，然后启用并保存。Token 使用 APP_ENCRYPTION_KEY 加密保存，接口不返回明文。可发送测试通知检查连接。

- 从 @BotFather 获取 Token；目标支持数字 Chat ID（例如 -1001234567890）或 @频道用户名。将机器人加入目标群组；频道需要授予发消息权限。
- 卡密首次变为 USED（号码转移完成，包括对账确认成功）后发送通知；购买失败、转移失败不会触发。
- 消息包含订单 ID、卡密 ID、号码尾号、费用、初始余额和 UTC 完成时间，不包含完整卡密、接收邮箱或订单访问令牌。
- 通知请求最长等待 8 秒。发送失败只记录日志，不影响兑换结果；当前不自动重试或补发，服务中断期间可能丢失通知。
- 升级时执行 `npx prisma migrate deploy` 和 `npx prisma generate`；Docker 启动脚本会应用迁移。通知默认关闭。

接口依据：[Telegram Bot API sendMessage](https://core.telegram.org/bots/api#sendmessage)。

### 兑换接收方式

用户兑换和转移失败重试均可填写 UserID 或 esim.gg 账户邮箱，任选其一。推荐 UserID；输入包含 @ 时按邮箱提交。切换接收方式会替换原接收方，避免旧信息混入。

### Key 余额与钱包成本

- 常驻 Node/Docker 服务启动后自动检测启用的 Key，此后每个 Key 至少间隔 5 分钟检测；慢请求或大量 Key 可能延长间隔。数据库条件更新避免多个实例重复领取同一个检测任务。
- 购买成功后刷新本次使用的 Key；后台列表每 30 秒更新。失败时保留上次成功余额及时间，并提示数据可能过期。
- 按当前确认的优惠估算：eSIM 基础费 €2.99 − 优惠券 €0.50 + 选号附加费用 + 初始余额，钱包支付手续费 €0.00，不含增值税。免费选号、初始余额 €0.50 时合计 €2.99。
- 估算基于当前优惠，实付统计仍以购买 API 的 `total_price` 为准，历史金额不改写。API 的 `number_price` 是选号附加费用，并非 eSIM 基础费。
- 升级需执行 `prisma migrate deploy`；Docker 入口脚本自动执行。后台检测不依赖管理员保持页面打开。

### 兑换运营设置

- 后台「设置 → 兑换开关与前台说明」可暂停新的兑换，填写可选暂停原因、购买链接及免责声明。暂停不影响已受理订单的查询和转移恢复。
- 后台概览和卡密管理显示全部 Key 已知余额、启用 Key 可用余额、有效未使用卡密预计金额。默认免费选号、初始余额 €0.50 时按 €2.99/张计算，不含支付手续费；允许付费选号时按价格上限预估。
- 处理中卡密另预留预计成本；已禁用、过期卡密不计入未使用金额。增发张数考虑钱包不能合并支付，低余额时显示需禁用张数或补充金额。余额未知、异常或超过 10 分钟未更新时不提供确定的增发建议。
- 各 Key 余额按 Key 累加，同一钱包请勿重复添加；余额与成本均为快照估计，以购买 API 实际扣费为准。

- 选号页新增「选号指引与下单须知」及完整目标号码核验入口，先在官方选好号码，再粘贴完整号码核验并确认兑换。付费或特选号码请联系客服人工补差办理。
- 「设置 → 兑换开关与前台说明」可修改在线客服链接，默认 `https://t.me/setup0de?direct`；留空可隐藏入口。

### 更新后的清理

在部署服务器确认新版健康后，执行 `sh scripts/deploy-cleanup.sh`。脚本保留当前镜像、1 个回滚镜像和最新的源码/数据库备份，清理更早的本站回滚镜像、旧备份、Docker 构建缓存及本次上传临时文件，并打印清理前后的磁盘占用。不会删除数据库卷或其他运行中服务的镜像。
