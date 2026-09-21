import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics DAL is server-only, operator-gated and selects a minimal DTO", async () => {
  const source = await readFile(
    new URL("../lib/analytics/data.ts", import.meta.url),
    "utf8",
  );
  const bookingSelect = source.match(
    /\.from\("bookings"\)\s*\.select\(\s*"([^"]+)"/,
  );

  assert.match(source, /import "server-only"/);
  assert.match(source, /isOperatorAccessConfigured/);
  assert.match(source, /verifyOperatorAuthorization/);
  assert.equal(
    bookingSelect?.[1],
    "status,price,currency,created_at,merchant_responded_at,service_id,services(name)",
  );
  assert.doesNotMatch(source, /original_request/);
  assert.doesNotMatch(source, /user_id/);
  assert.doesNotMatch(source, /request_id/);
  assert.doesNotMatch(source, /availability_id/);
});

test("analytics API rechecks bearer access and disables private caching", async () => {
  const route = await readFile(
    new URL("../app/api/analytics/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /request\.headers\.get\("authorization"\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /private, no-store/);
  assert.match(route, /WWW-Authenticate/);
  assert.match(route, /AnalyticsQuerySchema\.parse/);
});

test("analytics token stays in React memory and is never persisted", async () => {
  const page = await readFile(
    new URL("../app/analytics/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /useState\(""\)/);
  assert.match(page, /Authorization = `Bearer \$\{token\.trim\(\)\}`/);
  assert.match(page, /page&apos;s memory/);
  assert.doesNotMatch(page, /localStorage/);
  assert.doesNotMatch(page, /sessionStorage/);
  assert.doesNotMatch(page, /document\.cookie/);
});
