-- CreateEnum
CREATE TYPE "RedeemCodeStatus" AS ENUM ('UNUSED', 'LOCKED', 'PURCHASED', 'USED', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PURCHASING', 'PURCHASE_UNCERTAIN', 'PURCHASED', 'TRANSFERRING', 'TRANSFER_FAILED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "siteName" TEXT NOT NULL DEFAULT 'esim.gg 号码兑换',
    "encryptedEsimApiKey" TEXT,
    "initialBalance" DECIMAL(10,2) NOT NULL DEFAULT 0.05,
    "allowFreeNumbers" BOOLEAN NOT NULL DEFAULT true,
    "allowPaidNumbers" BOOLEAN NOT NULL DEFAULT false,
    "maxPaidNumberPrice" DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    "numberType" TEXT NOT NULL DEFAULT 'global',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RedeemCodeStatus" NOT NULL DEFAULT 'UNUSED',
    "expiresAt" TIMESTAMP(3),
    "batchId" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "redeemCodeId" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "numberPrice" DECIMAL(10,2) NOT NULL,
    "initialBalance" DECIMAL(10,2) NOT NULL,
    "recipientEmail" TEXT,
    "recipientAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseResponse" JSONB,
    "transferResponse" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSearchSession" (
    "id" TEXT NOT NULL,
    "redeemCodeId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_code_key" ON "RedeemCode"("code");

-- CreateIndex
CREATE INDEX "RedeemCode_status_idx" ON "RedeemCode"("status");

-- CreateIndex
CREATE INDEX "RedeemCode_batchId_idx" ON "RedeemCode"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_msisdn_idx" ON "Order"("msisdn");

-- CreateIndex
CREATE INDEX "Order_recipientEmail_idx" ON "Order"("recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSearchSession_sessionToken_key" ON "NumberSearchSession"("sessionToken");

-- CreateIndex
CREATE INDEX "NumberSearchSession_redeemCodeId_msisdn_idx" ON "NumberSearchSession"("redeemCodeId", "msisdn");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSearchSession" ADD CONSTRAINT "NumberSearchSession_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
