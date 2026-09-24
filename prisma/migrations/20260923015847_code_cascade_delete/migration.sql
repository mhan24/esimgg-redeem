-- DropForeignKey
ALTER TABLE "NumberSearchSession" DROP CONSTRAINT "NumberSearchSession_redeemCodeId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_redeemCodeId_fkey";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSearchSession" ADD CONSTRAINT "NumberSearchSession_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
