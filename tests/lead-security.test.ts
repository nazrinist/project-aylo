import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("lead DAL selects a minimal booking DTO and never queries requests", async () => {
  const source = await readFile(
    new URL("../lib/leads/data.ts", import.meta.url),
    "utf8",
  );
  const bookingSelect = source.match(
    /\.from\("bookings"\)\s*\.select\("([^"]+)"\)/,
  );

  assert.equal(
    bookingSelect?.[1],
    "id,booked_for,price,currency,status,created_at,services(name)",
  );
  assert.doesNotMatch(source, /\.from\("requests"\)/);
  assert.doesNotMatch(source, /original_request/);
  assert.doesNotMatch(source, /user_id/);
  assert.doesNotMatch(source, /request_id/);
});

test("live lead access uses a server-only constant-time bearer check", async () => {
  const access = await readFile(
    new URL("../lib/leads/access.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/leads/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(access, /import "server-only"/);
  assert.match(access, /timingSafeEqual/);
  assert.match(access, /AYLO_OPERATOR_TOKEN/);
  assert.doesNotMatch(access, /NEXT_PUBLIC_/);
  assert.match(route, /request\.headers\.get\("authorization"\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /private, no-store/);
  assert.match(route, /WWW-Authenticate/);
});
