import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import test from "node:test";

test("consumer cancellation rechecks cookie ownership and uses one atomic RPC", async () => {
  const dal = await readFile(
    new URL("../lib/bookings/cancellation.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/bookings/cancel/route.ts", import.meta.url),
    "utf8",
  );
  const token = await readFile(
    new URL("../lib/bookings/cancellation-token-core.ts", import.meta.url),
    "utf8",
  );

  assert.match(dal, /import "server-only"/);
  assert.match(dal, /readRequestHistoryIds\(historyToken\)/);
  assert.match(dal, /verifyConsumerBookingCancellationToken\(input\.actionToken\)/);
  assert.ok(
    dal.indexOf("readRequestHistoryIds(historyToken)") <
      dal.indexOf("verifyConsumerBookingCancellationToken(input.actionToken)"),
  );
  assert.match(dal, /\.rpc\("cancel_consumer_booking"/);
  assert.match(dal, /p_authorized_request_ids: requestIds/);
  assert.doesNotMatch(dal, /\.from\("bookings"\).*\.update/s);
  assert.match(route, /requireBetaAccess\(request\)/);
  assert.match(route, /requirePublicBetaRateLimit\(request, "booking"\)/);
  assert.match(route, /request\.cookies\.get\(REQUEST_HISTORY_COOKIE\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary: "Cookie"/);
  assert.ok(
    route.indexOf("requirePublicBetaRateLimit") < route.indexOf("request.json()"),
  );
  assert.doesNotMatch(route, /searchParams|get\(["']bookingId["']\)/);
  assert.match(token, /aes-256-gcm/);
  assert.match(token, /setAAD/);
  assert.match(token, /setAuthTag/);
});

test("Day 32 migration locks lifecycle rows and releases the slot atomically", () => {
  const sql = readFileSync(
    "supabase/migrations/0013_consumer_booking_cancellation.sql",
    "utf8",
  );

  assert.ok((sql.match(/for update;/gi) ?? []).length >= 3);
  assert.match(sql, /request_id = any\(p_authorized_request_ids\)/);
  assert.match(sql, /status not in \('pending_confirmation', 'accepted'\)/);
  assert.match(sql, /v_booking\.booked_for <= now\(\)/);
  assert.match(sql, /v_slot\.status <> 'booked'/);
  assert.match(sql, /update public\.availability\s+set status = 'available'/);
  assert.match(sql, /update public\.bookings[\s\S]*status = 'cancelled'/);
  assert.match(sql, /update public\.requests[\s\S]*status = 'cancelled'/);
  assert.match(sql, /new\.status in \('rejected', 'cancelled'\)/);
  assert.match(sql, /consumer_cancelled_at = now\(\)/);
  assert.match(sql, /set search_path = pg_catalog, pg_temp/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /\b(drop table|truncate table|delete from)\b/i);
});

test("consumer UI sends only an opaque action token after final confirmation", async () => {
  const page = await readFile(
    new URL("../app/bookings/page.tsx", import.meta.url),
    "utf8",
  );
  const data = await readFile(
    new URL("../lib/bookings/status-data.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /fetch\("\/api\/bookings\/cancel"/);
  assert.match(page, /JSON\.stringify\(\{ actionToken, confirmed: true \}\)/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /Final confirmation/);
  assert.match(page, /Confirm cancellation/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{[^}]*bookingId/s);
  assert.match(data, /consumerBookingCanCancel/);
  assert.match(data, /createConsumerBookingCancellationToken\(row\.id\)/);
});
