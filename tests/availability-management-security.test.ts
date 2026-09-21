import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("availability management uses shared server-only constant-time operator access", async () => {
  const access = await readFile(
    new URL("../lib/operator-access.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/availability/manage/route.ts", import.meta.url),
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

test("mutation DAL authorizes before parsing and only calls the atomic RPC", async () => {
  const source = await readFile(
    new URL("../lib/availability-management/mutation.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import "server-only"/);
  assert.ok(
    source.indexOf("verifyOperatorAuthorization") <
      source.indexOf("AvailabilityMutationInputSchema.parse"),
  );
  assert.match(source, /\.rpc\("manage_availability_slot"/);
  assert.doesNotMatch(source, /\.from\("bookings"\)/);
  assert.doesNotMatch(source, /\.from\("requests"\)/);
});

test("management reads never load customer or request data", async () => {
  const source = await readFile(
    new URL("../lib/availability-management/data.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /\.from\("bookings"\)/);
  assert.doesNotMatch(source, /\.from\("requests"\)/);
  assert.doesNotMatch(source, /original_request/);
  assert.doesNotMatch(source, /user_id/);
});

test("Day 20 SQL locks slots and protects booking-owned states", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/0008_availability_management.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /create or replace function public\.manage_availability_slot/);
  assert.match(sql, /security definer/);
  assert.match(sql, /for update/);
  assert.match(sql, /v_slot\.status in \('held', 'booked'\)/);
  assert.match(sql, /from public\.bookings as booking_row/);
  assert.match(sql, /p_start_time <= now\(\)/);
  assert.match(sql, /revoke all on function public\.manage_availability_slot/);
  assert.match(sql, /grant execute on function public\.manage_availability_slot[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});

test("rejected bookings detach from released slots for safe rebooking", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/0008_availability_management.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /detach_rejected_booking_slot/);
  assert.match(sql, /new\.availability_id := null/);
  assert.match(sql, /before update of status on public\.bookings/);
  assert.match(sql, /booking_row\.status = 'rejected'/);
});

test("legacy availability writes also require bearer authorization", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(new URL("../app/api/availability/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/availability/[id]/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of [collectionRoute, itemRoute]) {
    assert.match(source, /verifyOperatorAuthorization/);
    assert.match(source, /request\.headers\.get\("authorization"\)/);
    assert.match(source, /WWW-Authenticate/);
  }
});
