ALTER TABLE "SystemSetting"
ADD COLUMN "redemptionPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pauseReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN "purchaseUrl" TEXT NOT NULL DEFAULT 'https://shop.setup0.de/products/esimgg',
ADD COLUMN "disclaimer" TEXT NOT NULL DEFAULT '本站是使用 https://github.com/esimgg/api 进行的二次开发，通过搜寻号码、订购号码、转移线路所有权三项功能实现的自助转移，兑换号码均为 esim.gg 官方资源，余额为站点普通用户钱包。和官方购买并无二异（仅获得部分功能白名单），如不信任可以去官方自行购买，官方地址 https://esim.gg，优惠码可以用 SETUP，会优惠 0.4 欧元。';
