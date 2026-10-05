import { defineConfig } from "vitest/config";
import path from "node:path";

// Notification tests mock storage and Telegram; no database or real messages required.
export default defineConfig({
  test: { environment: "node", include: ["tests/unit/order-failure-recovery.test.ts", "tests/unit/telegram.test.ts", "tests/unit/recipient-transfer.test.ts", "tests/unit/esim-cost.test.ts", "tests/unit/key-balance-monitor.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
