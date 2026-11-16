import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Tests run against a throwaway Postgres (see docker-compose.yml, service `db-test`).
// They NEVER use DATABASE_URL from .env: that is usually your dev or hosted database.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54329/agileboard_test?schema=public";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // All files share one database, so run them one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      NEXTAUTH_SECRET: "test-secret",
      NEXT_PUBLIC_DEMO_MODE: "true",
      DEMO_USER_EMAIL: "demo@agileboard.dev",
    },
  },
});
