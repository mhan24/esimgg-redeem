ALTER TABLE "SystemSetting" ALTER COLUMN "disclaimer" SET DEFAULT '1. 独立第三方服务：本站提供 esim.gg 官方号码检索、自动化代购及所有权自助转移，与 esim.gg 为独立服务主体。
2. 资源与服务归属：号码均来自 esim.gg 官方资源。兑换并转移完成后，号码归属你的官方账户；后续充值、资费及网络服务以官方规则与服务条款为准。
3. 官方自购：如需直接购买，请访问 https://esim.gg。结账可尝试优惠码 SETUP，优惠金额以官方结账页面为准。
本平台通过 https://github.com/esimgg/api 提供的接口实现自助兑换。';
UPDATE "SystemSetting" SET "disclaimer" = '1. 独立第三方服务：本站提供 esim.gg 官方号码检索、自动化代购及所有权自助转移，与 esim.gg 为独立服务主体。
2. 资源与服务归属：号码均来自 esim.gg 官方资源。兑换并转移完成后，号码归属你的官方账户；后续充值、资费及网络服务以官方规则与服务条款为准。
3. 官方自购：如需直接购买，请访问 https://esim.gg。结账可尝试优惠码 SETUP，优惠金额以官方结账页面为准。
本平台通过 https://github.com/esimgg/api 提供的接口实现自助兑换。' WHERE "id" = 1 AND "disclaimer" IN ('本站是使用 https://github.com/esimgg/api 进行的二次开发，通过搜寻号码、订购号码、转移线路所有权三项功能实现的自助转移，兑换号码均为 esim.gg 官方资源，余额为站点普通用户钱包。和官方购买并无二异（仅获得部分功能白名单），如不信任可以去官方自行购买，官方地址 https://esim.gg，优惠码可以用 SETUP，会优惠 0.4 欧元。', '本站系基于开源项目（github.com/esimgg/api）二次开发的独立自动化服务平台，提供号码检索、订购及线路所有权自助转移服务。兑换号码底层资源均直接对接 esim.gg 官方接口并具备相应调用权限，结算扣减本站钱包余额。本站与官方为独立服务主体，如需直接采购官方服务，请访问 esim.gg
（结账输入优惠码 SETUP 可立减 0.4 欧元）。');
