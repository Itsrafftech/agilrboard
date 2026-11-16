import { execSync } from "node:child_process";

/**
 * Refuses to run unless the target database is clearly a local throwaway one,
 * then makes sure its schema matches prisma/schema.prisma (plain, non-destructive
 * `db push`). Data is wiped per test with TRUNCATE (see tests/helpers.ts).
 * To start from a blank schema, recreate the container:
 *   docker compose --profile test down && npm run test:db:up
 */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:54329/agileboard_test?schema=public";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL");
  }
  const db = parsed.pathname.replace(/^\//, "");
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (!localHost || !db.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL must point at a local database whose name ends in "_test" (got host=${parsed.hostname}, db=${db}). The schema is wiped on every run.`
    );
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("Refusing to run tests: TEST_DATABASE_URL equals DATABASE_URL.");
  }

  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `Could not prepare the test database at ${parsed.host}/${db}. Is it running? Start it with: npm run test:db:up\n` +
        `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`
    );
  }
}
