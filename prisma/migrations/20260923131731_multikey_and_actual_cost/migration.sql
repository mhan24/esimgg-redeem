-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "apiKeyId" TEXT,
ADD COLUMN     "costBreakdown" JSONB,
ADD COLUMN     "costTotal" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "keyLowBalanceThreshold" DECIMAL(10,2) NOT NULL DEFAULT 2.99,
ADD COLUMN     "keyStrategy" TEXT NOT NULL DEFAULT 'sequential';

-- CreateTable
CREATE TABLE "EsimApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastBalance" DECIMAL(10,2),
    "lastBalanceAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsimApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EsimApiKey_enabled_sortOrder_idx" ON "EsimApiKey"("enabled", "sortOrder");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "EsimApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 数据迁移 (规格 §71)
-- ============================================================

-- 1. 现有单个 API Key 迁入多 key 表 (用户要求保留), 成为第一个启用的 Key
INSERT INTO "EsimApiKey" ("id", "name", "encryptedKey", "enabled", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), '默认 Key', s."encryptedEsimApiKey", true, 0, NOW(), NOW()
FROM "SystemSetting" s
WHERE s."id" = 1 AND s."encryptedEsimApiKey" IS NOT NULL;

-- 2. 历史订单关联到该 Key (迁移前系统只有一个 Key, 这些号码都在它的账户下)
UPDATE "Order" o
SET "apiKeyId" = k."id"
FROM "EsimApiKey" k
WHERE o."apiKeyId" IS NULL
  AND o."purchaseResponse" IS NOT NULL
  AND k."name" = '默认 Key';

-- 3. 回填官方实付成本 (购买响应 total_price 为权威实付金额)
UPDATE "Order"
SET "costTotal" = ("purchaseResponse"->>'total_price')::numeric,
    "costBreakdown" = jsonb_build_object(
      'total', ("purchaseResponse"->>'total_price')::numeric,
      'numberPrice', CASE WHEN "purchaseResponse"->>'number_price' ~ '^[0-9]+(\.[0-9]+)?$'
                          THEN ("purchaseResponse"->>'number_price')::numeric END,
      'vatAmount', CASE WHEN "purchaseResponse"->>'vat_amount' ~ '^[0-9]+(\.[0-9]+)?$'
                        THEN ("purchaseResponse"->>'vat_amount')::numeric END,
      'currency', 'EUR',
      'source', 'purchase_response',
      'backfilled', true
    )
WHERE "purchaseResponse"->>'total_price' ~ '^[0-9]+(\.[0-9]+)?$';
