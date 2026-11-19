import { defineConfig } from "vitest/config";
import path from "node:path";

// Pin the process zone to UTC so tests prove nothing depends on the host zone.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(".") } },
  test: { include: ["tests/**/*.test.ts"] },
});
