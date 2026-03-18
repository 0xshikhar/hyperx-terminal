import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret",
      NODE_ENV: "test",
      DEMO_MODE: "false",
      DEMO_ALLOW_TRADES: "false",
    },
    fileParallelism: false,
  },
});
