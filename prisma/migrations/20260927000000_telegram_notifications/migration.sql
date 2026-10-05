ALTER TABLE "SystemSetting" ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "encryptedTelegramToken" TEXT,
ADD COLUMN "telegramChatId" TEXT;
