-- Retain the encrypted credential for manual review; never silently activate it.
INSERT INTO "EsimApiKey" ("id", "name", "encryptedKey", "enabled", "sortOrder", "updatedAt")
SELECT 'retired-single-key-' || "id"::text, '历史单 Key（待核实）', "encryptedEsimApiKey", false, 0, CURRENT_TIMESTAMP
FROM "SystemSetting" WHERE "encryptedEsimApiKey" IS NOT NULL;
ALTER TABLE "SystemSetting" DROP COLUMN "encryptedEsimApiKey";
