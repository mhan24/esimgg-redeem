# esim.gg 选号兑换系统开发规格

## 1. 项目概述

开发一个基于 esim.gg Customer API 的号码兑换/选号系统。

系统与独角数卡（Dujiao / Dujiao-Next）解耦：

- 独角数卡只负责销售商品并向用户发放卡密。
- 本系统负责卡密生成、卡密验证、号码搜索、选号、购买号码、初始化余额以及将号码转移至用户指定的 esim.gg 账户。
- 不需要对接独角数卡 API。
- 管理员在本系统后台生成卡密，然后将卡密导出并导入独角数卡销售。
- 用户购买商品获得卡密后，进入本系统完成选号。

核心业务流程：

```text
管理员后台生成卡密
        ↓
导出卡密
        ↓
导入独角数卡
        ↓
用户购买商品
        ↓
获得卡密
        ↓
进入选号站
        ↓
输入卡密
        ↓
验证成功
        ↓
搜索号码
        ↓
选择号码
        ↓
填写 esim.gg 注册邮箱
        ↓
确认购买
        ↓
服务器购买号码
        ↓
确认号码已经进入平台账户
        ↓
转移号码 Ownership
        ↓
转移至用户 esim.gg 账户
        ↓
兑换完成
```

------

# 2. 推荐技术栈

推荐：

```text
Next.js
TypeScript
React
Tailwind CSS

PostgreSQL
Prisma ORM

Docker
Docker Compose
```

生产环境数据库优先 PostgreSQL。

不要使用浏览器直接调用 esim.gg API。

所有 esim.gg API 请求必须经过服务端。

------

# 3. esim.gg API

官方文档：

https://github.com/esimgg/api

Base URL：

```text
https://api.esim.gg/api
```

认证：

```http
Authorization: Bearer <API_KEY>
```

涉及具体号码的接口：

```http
X-MSISDN: 372XXXXXXXX
```

API Key 绝对不能发送给前端。

------

# 4. 后台管理系统

后台路径：

```text
/admin
```

需要管理员登录。

至少包含：

```text
Dashboard

卡密管理

订单管理

异常订单

esim.gg API 设置

选号设置

系统设置
```

------

# 5. Dashboard

展示：

```text
Wallet EUR 余额

卡密总数
未使用卡密
已使用卡密
禁用卡密

订单总数
今日订单

购买成功数量
转移成功数量
转移失败数量

号码购买金额
初始化余额支出
```

Wallet 余额通过：

```http
GET /wallet/balance?currency=eur
```

获取。

------

# 6. API Key 管理

后台允许管理员填写：

```text
esim.gg API Key
```

界面：

```text
API Key

[ ************************ ]

连接状态：
● 正常

Wallet：
€123.45

[测试连接]

[保存]
```

测试连接调用：

```http
GET /wallet/balance?currency=eur
```

成功：

```json
{
  "currency": "EUR",
  "balance": 123.45
}
```

API Key 不允许返回给浏览器。

数据库中推荐加密保存 API Key。

推荐：

```text
AES-256-GCM
```

主密钥：

```env
APP_ENCRYPTION_KEY=
```

------

# 7. 选号系统设置

后台需要以下设置：

```text
initial_balance

allow_free_numbers

allow_paid_numbers

max_paid_number_price

number_type
```

默认：

```text
initial_balance = 0.05

allow_free_numbers = true

allow_paid_numbers = false

max_paid_number_price = 2.00

number_type = global
```

后台 UI：

```text
选号设置

初始余额
[ 0.05 ] EUR


允许号码类型

☑ 免费号码

☐ 付费号码


付费号码最高价格

[ 2.00 ] EUR


号码类型

[ Global ▼ ]


[保存]
```

注意：

当前 esim.gg 公共 API 文档说明：

```text
recharge_amount 标准最低金额为 1.00 EUR
```

但账户可能存在 account-specific minimum。

因此系统不能把最低值硬编码成 1 EUR。

管理员应该可以自行设置：

```text
0.05
1.00
2.00
...
```

如果 esim.gg API 拒绝该金额，则将真实 API 错误反馈给管理员/订单日志。

------

# 8. 免费号码模式

如果：

```text
allow_free_numbers = true

allow_paid_numbers = false
```

搜索必须调用：

```http
POST /number/search
```

Body：

```json
{
  "search": "372",
  "type": "global",
  "zero_price_only": true
}
```

只能向用户展示：

```text
price = 0
```

的号码。

即使 API 出现异常返回，也必须由服务端再次过滤：

```typescript
numbers.filter(number => Number(number.price) === 0)
```

不能只依赖前端。

------

# 9. 允许付费号码模式

如果：

```text
allow_paid_numbers = true
```

则：

```json
{
  "search": "372",
  "type": "global",
  "zero_price_only": false
}
```

允许展示免费和付费号码。

必须执行价格过滤：

```text
price <= max_paid_number_price
```

例如：

```text
max_paid_number_price = 2.00
```

则：

```text
€0.00     显示

€0.50     显示

€1.50     显示

€2.00     显示

€2.01     不显示

€5.00     不显示
```

------

# 10. 免费/付费组合规则

需要支持：

## 模式 A

```text
免费 ON
付费 OFF
```

只显示免费号码。

## 模式 B

```text
免费 ON
付费 ON
```

显示：

```text
免费号码

+

价格 <= max_paid_number_price 的付费号码
```

## 模式 C

```text
免费 OFF
付费 ON
```

只显示：

```text
price > 0

AND

price <= max_paid_number_price
```

## 模式 D

```text
免费 OFF
付费 OFF
```

禁止选号。

前台显示：

```text
当前暂未开放号码兑换。
```

------

# 11. 搜索限制

esim.gg 当前 API 对号码搜索存在：

```text
10 requests / minute / user
```

限制。

系统必须避免用户高频请求。

建议：

```text
最短搜索间隔：3 秒
```

同时服务端增加 Rate Limit。

例如：

```text
单个兑换 Session：

10 requests / minute
```

禁止前端：

```text
每输入一个字符立即搜索
```

推荐：

```text
用户输入号码特征

[37255           ]

[搜索]
```

由用户主动点击搜索。

------

# 12. 搜索 Session

不能相信浏览器提交的号码价格。

错误设计：

```json
{
  "msisdn": "37212345678",
  "price": 0
}
```

然后服务器直接购买。

攻击者可以修改请求。

正确设计：

服务器搜索 esim.gg 后创建：

```text
NumberSearchSession
```

保存：

```text
session_id

redeem_code_id

msisdn

price

created_at

expires_at
```

例如：

```text
session:

37211111111 €0
37222222222 €0
37233333333 €1.00
```

用户选择号码时只提交：

```json
{
  "msisdn": "37211111111"
}
```

服务器从 SearchSession 获取真实价格。

------

# 13. Search Session 有效期

建议：

```text
5 minutes
```

例如：

```text
expires_at = created_at + 5 minutes
```

号码搜索结果不是号码预留。

因此购买时号码可能已经被其他用户购买。

系统必须正确处理：

```text
NUMBER_UNAVAILABLE
```

之类的 API 错误。

用户应该可以重新选号，而不是直接消耗卡密。

------

# 14. 卡密系统

管理员可以：

```text
生成单个卡密

批量生成卡密

禁用卡密

启用卡密

删除未使用卡密

查看卡密订单

导出 TXT

导出 CSV
```

生成界面：

```text
生成卡密

数量：

[ 100 ]


前缀：

[ ESIM ]


有效期：

[ 永久 ▼ ]


备注：

[ 独角第一批 ]


[生成]
```

------

# 15. 卡密格式

推荐：

```text
ESIM-XXXX-XXXX-XXXX
```

例如：

```text
ESIM-V8K2-XM7P-N4Q9

ESIM-K3HF-92MA-X8PW

ESIM-7WQ4-MNP8-6K2R
```

必须使用密码学安全随机数生成器。

禁止：

```text
Math.random()
```

推荐：

```typescript
crypto.randomBytes()
```

卡密必须具有 UNIQUE 数据库约束。

------

# 16. 卡密状态

至少：

```text
UNUSED

LOCKED

PURCHASED

USED

DISABLED
```

含义：

### UNUSED

未使用。

可以开始兑换。

### LOCKED

用户已经进入确认/购买阶段。

避免两个请求同时使用同一卡密。

### PURCHASED

号码已经购买成功。

此状态非常重要。

此时：

```text
禁止再次购买号码
```

即使 Ownership Transfer 失败。

### USED

号码已经成功转移。

订单完成。

### DISABLED

管理员禁用。

------

# 17. 卡密并发安全

必须防止：

```text
同一卡密
同时打开两个浏览器
同时点击购买
```

导致购买两个号码。

购买时必须使用数据库事务/行锁/原子状态更新。

例如逻辑：

```sql
UPDATE redeem_codes

SET status = 'LOCKED'

WHERE id = ?

AND status = 'UNUSED'
```

如果：

```text
affected rows = 0
```

则拒绝购买。

禁止：

```text
SELECT status

if unused

UPDATE
```

这种存在 race condition 的实现。

------

# 18. 卡密锁释放

如果：

```text
号码尚未购买
```

而订单失败，例如：

```text
号码已被别人购买

Wallet 余额不足

API 请求明确返回购买失败
```

可以恢复：

```text
LOCKED → UNUSED
```

但是：

只要确认号码已经成功购买：

```text
LOCKED → PURCHASED
```

永远不能自动恢复：

```text
PURCHASED → UNUSED
```

------

# 19. 用户兑换页面

首页：

```text
欢迎使用号码兑换

请输入兑换码：

[ ESIM-XXXX-XXXX-XXXX ]

[开始选号]
```

------

# 20. 卡密验证

用户提交：

```http
POST /api/redeem/verify
```

Body：

```json
{
  "code": "ESIM-XXXX-XXXX-XXXX"
}
```

验证：

```text
卡密存在

未禁用

未过期

状态允许使用
```

------

# 21. 已购买卡密再次访问

如果：

```text
status = PURCHASED
```

不能提示：

```text
卡密已使用
```

而应该恢复订单。

例如：

```text
号码：

+372 XXXXXXXX


状态：

号码购买成功
等待转移


上次邮箱：

abc@example.com


转移失败：

ACCOUNT_NOT_FOUND


请输入新的 esim.gg 邮箱：

[                       ]

[重新转移]
```

这样用户可以继续完成 Ownership Transfer。

------

# 22. 用户选号页面

例如：

```text
搜索号码

[37255             ]

[搜索]


可用号码


+372 5512 3456

号码价格：

免费

[选择]


+372 5588 1234

号码价格：

€1.00

[选择]
```

如果付费号码关闭，则永远不能出现付费号码。

------

# 23. 订单确认页面

用户选择号码后：

```text
确认兑换


号码：

+372 XXXXXXXX


号码价格：

免费


初始余额：

€0.05


接收 esim.gg 邮箱：

[ user@example.com ]


注意：

邮箱必须已经注册 esim.gg。

Ownership Transfer 成功后无法撤销。


[确认兑换]
```

------

# 24. 创建号码

调用：

```http
POST /checkout/new_line
```

Body：

```json
{
  "msisdn": "372XXXXXXXX",
  "payment_method": "wallet",
  "recharge_amount": "0.05"
}
```

其中：

```text
recharge_amount
```

来自后台：

```text
initial_balance
```

禁止前端决定该值。

------

# 25. 购买前安全检查

服务器必须重新检查：

```text
卡密状态

订单状态

Search Session

号码价格

免费/付费设置

max_paid_number_price

Wallet/API 配置
```

如果：

```text
allow_paid_numbers = false
```

并且：

```text
price > 0
```

立即拒绝。

如果：

```text
allow_paid_numbers = true
```

但：

```text
price > max_paid_number_price
```

立即拒绝。

------

# 26. 不允许自动重试购买

这是整个项目的重要要求。

esim.gg 官方明确提醒：

如果：

```text
POST /checkout/new_line
```

没有返回最终结果，例如：

```text
Timeout

Connection reset

502

Gateway timeout
```

禁止直接再次调用：

```text
/checkout/new_line
```

因为第一次请求可能已经购买成功。

否则可能购买两个号码。

------

# 27. Purchase Reconciliation

如果购买结果不确定：

首先：

```http
GET /line/all
```

返回：

```json
{
  "lines": [
    {
      "number": "372XXXXXXXX"
    }
  ]
}
```

检查目标号码是否已经属于当前账户。

如果存在：

```text
视为购买成功
```

订单：

```text
PURCHASED
```

然后进入 Ownership Transfer。

如果不存在：

订单：

```text
PURCHASE_UNCERTAIN
```

不要自动再次购买。

允许管理员后台处理。

------

# 28. Ownership Transfer

号码购买成功后调用：

```http
POST /line/transfer_ownership
```

Header：

```http
Authorization: Bearer <API_KEY>

X-MSISDN: 372XXXXXXXX
```

Body：

```json
{
  "recipient_email": "user@example.com"
}
```

------

# 29. Transfer 前提

用户邮箱必须：

```text
已经注册 esim.gg
```

Email Transfer 只有在：

```text
email 唯一对应一个 account
```

时才能成功。

如果同一邮箱对应多个 account，则 API 会失败。

这种情况下需要：

```text
recipient_account_id
```

因此数据库和后端设计最好同时支持：

```text
recipient_email

recipient_account_id
```

第一版 UI 可以只开放 email。

管理员后台允许手动填写 Account ID 重试。

------

# 30. Ownership Transfer 不允许重复购买

例如：

```text
购买号码
    ↓
成功
    ↓
Transfer
    ↓
失败
```

此时订单：

```text
TRANSFER_FAILED
```

卡密：

```text
PURCHASED
```

绝对禁止：

```text
重新选号

重新购买
```

只允许：

```text
修改 recipient_email

或者

填写 recipient_account_id

然后重新 Transfer
```

------

# 31. Transfer 重试

Transfer 本身可以独立重试。

例如：

```http
POST /api/order/:id/retry-transfer
```

Body：

```json
{
  "recipient_email": "new@example.com"
}
```

后端首先确认：

```text
号码仍然属于平台 esim.gg Account
```

然后重新调用：

```text
/line/transfer_ownership
```

成功：

```text
Order → COMPLETED

RedeemCode → USED
```

------

# 32. 订单状态

建议：

```text
PENDING

PURCHASING

PURCHASE_UNCERTAIN

PURCHASED

TRANSFERRING

TRANSFER_FAILED

COMPLETED

FAILED
```

状态流：

```text
PENDING
   ↓
PURCHASING
   ↓
PURCHASED
   ↓
TRANSFERRING
   ↓
COMPLETED
```

异常：

```text
PURCHASING
   ↓
PURCHASE_UNCERTAIN
```

或者：

```text
TRANSFERRING
   ↓
TRANSFER_FAILED
```

------

# 33. 数据库模型

建议至少：

```text
Admin

SystemSetting

RedeemCode

Order

NumberSearchSession

AuditLog
```

------

# 34. RedeemCode

示例：

```text
id

code

status

expires_at

batch_id

remark

created_at

locked_at

used_at
```

`code` 必须 UNIQUE。

------

# 35. Order

至少：

```text
id

redeem_code_id

msisdn

number_price

initial_balance

recipient_email

recipient_account_id

status

purchase_response

transfer_response

error_code

error_message

created_at

purchased_at

completed_at
```

购买时必须保存：

```text
number_price

initial_balance
```

作为订单快照。

后续管理员修改系统设置不能影响历史订单。

------

# 36. NumberSearchSession

至少：

```text
id

redeem_code_id

session_token

msisdn

price

expires_at

created_at
```

用于防止客户端篡改号码价格。

------

# 37. SystemSetting

至少：

```text
site_name

encrypted_esim_api_key

initial_balance

allow_free_numbers

allow_paid_numbers

max_paid_number_price

number_type

created_at

updated_at
```

------

# 38. AuditLog

记录后台敏感操作：

```text
修改 API Key

修改初始余额

开启付费号码

修改最高号码价格

生成卡密

禁用卡密

人工重试 Transfer

人工修改订单
```

字段：

```text
id

admin_id

action

target_type

target_id

metadata

ip

created_at
```

------

# 39. 后台订单页面

列表：

```text
订单号

卡密

号码

号码价格

初始余额

邮箱

状态

创建时间

完成时间
```

支持：

```text
按状态筛选

按号码搜索

按邮箱搜索

按卡密搜索
```

------

# 40. 异常订单页面

重点显示：

```text
PURCHASE_UNCERTAIN

TRANSFER_FAILED
```

对于：

```text
TRANSFER_FAILED
```

管理员可以：

```text
修改邮箱

填写 Account ID

重新 Transfer
```

禁止后台按钮：

```text
重新购买
```

除非管理员明确执行特殊人工操作，并有二次确认。

------

# 41. Wallet 保护

每次购买前可以检查：

```http
GET /wallet/balance?currency=eur
```

理论成本：

```text
number_price + initial_balance
```

如果 Wallet 明显不足：

```text
拒绝购买
```

提示：

```text
系统余额不足，请联系管理员。
```

但最终价格和 VAT 等仍以 esim.gg API 实际结果为准。

------

# 42. API Rate Limit

本系统至少需要：

```text
卡密验证限流

号码搜索限流

订单提交限流

Transfer 重试限流

后台登录限流
```

推荐 Redis。

第一版小规模部署也可以使用数据库/内存 Rate Limiter。

------

# 43. 防暴力破解卡密

不能允许攻击者无限尝试：

```text
ESIM-XXXX-XXXX-XXXX
```

建议：

```text
单 IP：

10 次失败 / 10 分钟

超过后暂时限制
```

卡密本身必须有足够熵。

------

# 44. 管理员认证

禁止简单明文密码。

使用：

```text
Argon2id
```

或：

```text
bcrypt
```

保存 password hash。

Session Cookie：

```text
HttpOnly

Secure

SameSite=Lax
```

------

# 45. CSRF

后台所有：

```text
POST

PUT

PATCH

DELETE
```

操作需要 CSRF 防护或可靠的 SameSite + Origin 验证方案。

------

# 46. API Key 安全

禁止：

```text
NEXT_PUBLIC_ESIM_API_KEY
```

禁止：

```text
localStorage
```

禁止 API Key 出现在：

```text
HTML

JavaScript bundle

浏览器 Network Response

日志
```

所有请求只能：

```text
Browser

↓

Our Backend

↓

esim.gg
```

------

# 47. 日志脱敏

日志不能记录：

```text
完整 API Key
```

可以：

```text
esim_****abcd
```

用户邮箱建议根据后台权限适当脱敏。

------

# 48. 前端 API

建议：

```text
POST
/api/redeem/verify


POST
/api/numbers/search


POST
/api/orders


GET
/api/orders/:token


POST
/api/orders/:token/retry-transfer
```

------

# 49. Admin API

建议：

```text
POST
/api/admin/login


POST
/api/admin/logout


GET
/api/admin/dashboard


GET
/api/admin/codes


POST
/api/admin/codes/generate


POST
/api/admin/codes/:id/disable


POST
/api/admin/codes/:id/enable


GET
/api/admin/codes/export


GET
/api/admin/orders


GET
/api/admin/orders/:id


POST
/api/admin/orders/:id/retry-transfer


GET
/api/admin/settings


PATCH
/api/admin/settings


POST
/api/admin/esim/test


GET
/api/admin/esim/wallet
```

------

# 50. 前台成功页面

Transfer 成功：

```text
兑换成功


号码：

+372 XXXXXXXX


已转移至：

user@example.com


请登录 esim.gg 查看号码。
```

不要向用户暴露：

```text
API Key

内部 API Response

数据库 ID

内部错误 Stack
```

------

# 51. 用户错误提示

号码被抢：

```text
该号码已不可用，请重新选择号码。
```

Wallet 不足：

```text
系统余额不足，请联系管理员。
```

邮箱不存在：

```text
号码已经购买成功，但无法转移至该邮箱。

请确认该邮箱已经注册 esim.gg，然后重新提交接收邮箱。

不会重复购买号码。
```

API Rate Limit：

```text
请求过于频繁，请稍后再试。
```

------

# 52. Docker

项目必须提供：

```text
Dockerfile

docker-compose.yml

.env.example
```

推荐：

```yaml
services:

  app:

  postgres:
```

可选：

```text
redis
```

------

# 53. 环境变量

`.env.example`：

```env
DATABASE_URL=

APP_URL=

SESSION_SECRET=

APP_ENCRYPTION_KEY=

ADMIN_INITIAL_USERNAME=admin

ADMIN_INITIAL_PASSWORD=

ESIM_API_BASE_URL=https://api.esim.gg/api
```

API Key 推荐由后台配置。

不要把真实 API Key 写进：

```text
.env.example
```

------

# 54. 首次启动

如果数据库不存在管理员：

从：

```text
ADMIN_INITIAL_USERNAME

ADMIN_INITIAL_PASSWORD
```

创建管理员。

创建后建议提示管理员修改密码。

------

# 55. 数据库 Migration

必须使用 Prisma Migration。

提供：

```bash
npx prisma migrate deploy
```

生产部署流程。

------

# 56. 健康检查

提供：

```http
GET /api/health
```

返回：

```json
{
  "status": "ok"
}
```

可以附加：

```text
database
```

状态。

不能泄露敏感配置。

------

# 57. 关键业务原则

开发过程中必须始终遵守以下原则。

## 原则 1

一张卡密最多购买一个号码。

## 原则 2

号码一旦购买成功，卡密绝对不能恢复 UNUSED。

## 原则 3

Transfer 失败只能重新 Transfer，不能重新购买。

## 原则 4

购买请求 Timeout 后不能直接重新购买。

必须通过：

```text
/line/all
```

进行 reconciliation。

## 原则 5

不能相信客户端提交的号码价格。

## 原则 6

免费号码模式下，服务器必须保证：

```text
price === 0
```

## 原则 7

付费号码必须满足：

```text
price <= max_paid_number_price
```

## 原则 8

API Key 永远不能到浏览器。

## 原则 9

订单必须保存购买时的：

```text
number_price

initial_balance
```

快照。

## 原则 10

所有关键状态变化必须具有并发安全性。

------

# 58. esim.gg API Client

建议创建：

```text
src/lib/esim/client.ts
```

统一封装：

```typescript
getWalletBalance()

searchNumbers()

purchaseNumber()

listLines()

getLine()

transferOwnership()
```

禁止业务代码到处直接：

```typescript
fetch("https://api.esim.gg/...")
```

------

# 59. API Error

创建统一错误类型：

```typescript
class EsimApiError extends Error {

    statusCode

    errorCode

    response

}
```

区分：

```text
业务失败

网络失败

Timeout

429

5xx
```

尤其：

```text
purchaseNumber()
```

必须能够区分：

```text
明确失败
```

和：

```text
结果未知
```

------

# 60. Purchase Service

建议：

```text
src/services/purchase-service.ts
```

负责完整购买状态机。

伪代码：

```typescript
async function purchase(orderId) {

    acquireOrderLock()

    validateRedeemCode()

    validateSearchSession()

    validateNumberPrice()

    setOrderStatus("PURCHASING")

    try {

        result = await esim.purchaseNumber()

    } catch (error) {

        if (isDefinitiveFailure(error)) {

            unlockCodeIfSafe()

            markFailed()

            return

        }

        // Timeout / uncertain response

        lines = await esim.listLines()

        if (lineExists(lines, msisdn)) {

            markPurchased()

        } else {

            markPurchaseUncertain()

            return
        }
    }

    markPurchased()

    await transfer(orderId)
}
```

------

# 61. Transfer Service

```typescript
async function transfer(orderId) {

    order = getOrder()

    assert(order.status === "PURCHASED"
        || order.status === "TRANSFER_FAILED")

    verifyLineStillOwned()

    markTransferring()

    try {

        await esim.transferOwnership()

        markCompleted()

        markRedeemCodeUsed()

    } catch (error) {

        markTransferFailed()

    }
}
```

------

# 62. 测试

必须至少覆盖以下测试。

## 卡密并发

两个请求同时使用同一卡密：

```text
只能有一个成功进入购买流程。
```

## 免费号码保护

客户端尝试提交付费号码：

```text
必须拒绝。
```

## 最高价格

```text
max = €2

号码 = €3
```

必须拒绝。

## Purchase Timeout

模拟：

```text
purchase API timeout
```

然后：

```text
line/all
```

存在号码。

系统必须：

```text
继续 Transfer
```

而不是重新购买。

## Transfer Failure

购买成功、Transfer 失败：

```text
卡密不能重新选号。
```

## Transfer Retry

修改邮箱：

```text
再次 Transfer
```

成功：

```text
COMPLETED
```

## API Key

任何前台 Response 都不能包含 API Key。

------

# 63. README

项目最终必须提供完整 README：

```text
项目介绍

环境要求

Docker 部署

普通部署

环境变量

初始化管理员

数据库 Migration

后台地址

卡密生成方法

独角数卡导入方法

esim.gg API Key 配置

免费号码设置

付费号码设置

订单异常处理

备份方法

升级方法
```

------

# 64. UI 要求

整体 UI：

```text
简洁

移动端友好

Dark / Light 均可

避免复杂动画
```

用户兑换过程尽量控制在：

```text
卡密

↓

选号

↓

确认

↓

完成
```

四步以内。

------

# 65. 第一版开发范围

V1 必须完成：

```text
管理员登录

Dashboard

API Key 设置

API 连接测试

Wallet 显示

初始余额设置

免费号码开关

付费号码开关

付费号码最高价格

卡密批量生成

TXT 导出

CSV 导出

卡密禁用

用户卡密验证

号码搜索

免费号码过滤

付费号码过滤

选号

创建订单

号码购买

Purchase Reconciliation

Ownership Transfer

Transfer Failure Recovery

修改邮箱重新 Transfer

订单管理

异常订单管理

Docker 部署

PostgreSQL

Audit Log
```

------

# 66. 暂不开发

V1 不需要：

```text
独角数卡 API 对接

在线支付

用户注册系统

用户密码

多商户

代理商系统

余额充值系统

自动退款

多 esim.gg API Account
```

独角数卡与本项目通过：

```text
卡密
```

连接即可。

------

# 67. 最终验收流程

管理员：

```text
登录后台

↓

填写 esim.gg API Key

↓

测试 API

↓

看到 Wallet Balance

↓

设置：

initial_balance = 0.05

allow_free_numbers = true

allow_paid_numbers = false

↓

生成 100 个卡密

↓

导出 TXT

↓

导入独角数卡
```

用户：

```text
从独角购买

↓

得到卡密

↓

打开选号站

↓

输入卡密

↓

搜索号码

↓

只能看到免费号码

↓

选择号码

↓

填写已经注册 esim.gg 的邮箱

↓

确认

↓

系统购买号码

↓

初始化指定余额

↓

Ownership Transfer

↓

号码进入用户 esim.gg Account

↓

卡密 USED
```

异常情况：

```text
号码购买成功

↓

邮箱 Transfer 失败

↓

卡密保持 PURCHASED

↓

用户再次输入原卡密

↓

恢复原订单

↓

修改邮箱

↓

重新 Transfer

↓

成功

↓

USED
```

整个过程中绝对不能因为 Transfer 失败而再次购买号码。

------

# 68. 开发优先级

按照以下顺序开发：

```text
1. Prisma Schema

2. Admin Authentication

3. System Settings

4. esim.gg API Client

5. API Test / Wallet

6. Redeem Code

7. Number Search

8. Search Session

9. Order State Machine

10. Purchase

11. Purchase Reconciliation

12. Ownership Transfer

13. Transfer Recovery

14. Admin Orders

15. Audit Log

16. Rate Limit

17. Docker

18. Tests

19. README
```

不要先做复杂 UI。

首先确保：

```text
并发安全

购买幂等性

卡密状态

订单状态

API 安全

Purchase Reconciliation
```

正确，再完善界面。
------

# 69. 人机验证 (Cloudflare Turnstile)

对外的两个写入口接入 Cloudflare Turnstile，与既有 Rate Limit (规格 §42) 叠加形成两层防护：

```text
用户兑换码验证  POST /api/redeem/verify
管理员登录      POST /api/admin/login
```

配置：

| 变量 | 说明 |
|---|---|
| `TURNSTILE_SITE_KEY` | 站点密钥 (公开信息)，经 `GET /api/turnstile/config` 下发给浏览器 |
| `TURNSTILE_SECRET_KEY` | 密钥，仅服务端用于调用 siteverify，绝不下发浏览器/日志/前端响应 |

两项均留空时自动关闭校验 (本地开发/测试不受影响)；只配其中一项视为未启用。

服务端策略：

```text
未配置密钥        -> 跳过校验
缺少 token        -> 拒绝
success:false     -> 拒绝
HTTP 非 2xx/超时  -> 失败关闭 (拒绝)，避免校验服务不可用时被绕过
```

token 为一次性，有效期约 300 秒；前端在校验失败后重置 widget 以获取新 token。
站点密钥不走 `NEXT_PUBLIC_*` 构建期内联 (Docker 构建上下文通过 .dockerignore 排除 .env)，
改为运行时接口下发，保证镜像构建环境与运行环境一致，也便于轮换密钥而无需重新构建镜像。

------

# 70. 管理员账号自管理

后台提供账号设置页（`/admin/account`，导航"账号设置"或点击导航栏用户名进入）：

```text
修改用户名   当前密码 + 新用户名 (3-32 位字母/数字/下划线/连字符, 不可与他人重复)
修改密码     当前密码 + 新密码 (8-72 位) + 确认新密码
```

规则：

```text
必须验证当前密码 (用户名与密码修改同样要求)
用户名与密码可同时修改, 单条 update 原子生效
新用户名不能与当前用户名相同, 不能已被占用 (唯一约束冲突同样按占用处理)
新密码不能与当前密码相同
当前密码连续错误 5 次 / 10 分钟 / IP 触发限流 (规格 §42)
成功后重签发会话 Cookie (同步用户名并刷新 12 小时 TTL)
每次变更写审计日志 (规格 §38): USERNAME_CHANGE 记录 from/to, PASSWORD_CHANGE 仅记录 changed:true
```

密码绝不写入日志、审计元数据或任何响应；哈希使用 bcrypt(10)，与登录校验一致。
