import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openRescheduleToken, sealRescheduleToken, RESCHEDULE_TOKEN_TTL_MS } from "../lib/bookings/reschedule-token-core.ts";
import { ConsumerRescheduleInputSchema, ConsumerRescheduleOptionsInputSchema } from "../types/booking.ts";

const bookingId = "40000000-0000-4000-8000-000000000001";
const slotId = "40000000-0000-4000-8000-000000000002";
const secret = "day-33-reschedule-token-secret-is-long-enough";
const now = Date.parse("2026-09-29T09:00:00Z");

test("reschedule option is opaque, purpose-bound, authenticated and expires", () => {
  const start = sealRescheduleToken({ kind: "start", bookingId, bookedFor: "2026-10-02T12:00:00Z" }, secret, now, Buffer.alloc(12, 21));
  const option = sealRescheduleToken({ kind: "option", bookingId, bookedFor: "2026-10-02T12:00:00Z", lastRescheduledAt: null, slotId }, secret, now, Buffer.alloc(12, 22));
  assert.equal(start.includes(bookingId), false);
  assert.equal(option.includes(slotId), false);
  assert.equal(openRescheduleToken(start, secret, now + 1)?.kind, "start");
  assert.deepEqual(openRescheduleToken(option, secret, now + 1), {
    kind: "option", bookingId, bookedFor: "2026-10-02T12:00:00Z", lastRescheduledAt: null, slotId,
    issuedAt: now, expiresAt: now + RESCHEDULE_TOKEN_TTL_MS,
  });
  assert.equal(openRescheduleToken(option, secret + "wrong", now), null);
  assert.equal(openRescheduleToken(option, secret, now + RESCHEDULE_TOKEN_TTL_MS), null);
  const pieces = option.split(".");
  pieces[2] = pieces[2].slice(0, -1) + (pieces[2].endsWith("A") ? "B" : "A");
  assert.equal(openRescheduleToken(pieces.join("."), secret, now), null);
});

test("rescheduling accepts only explicit confirmation and opaque tokens", () => {
  assert.equal(ConsumerRescheduleOptionsInputSchema.safeParse({ actionToken: "x".repeat(64) }).success, true);
  assert.equal(ConsumerRescheduleInputSchema.safeParse({ optionToken: "x".repeat(64), confirmed: true }).success, true);
  assert.equal(ConsumerRescheduleInputSchema.safeParse({ optionToken: "x".repeat(64), confirmed: false }).success, false);
  assert.equal(ConsumerRescheduleInputSchema.safeParse({ optionToken: "x".repeat(64), confirmed: true, slotId }).success, false);
});

test("reschedule data and SQL recheck browser ownership, state and both slots", async () => {
  const [dal, sql, page] = await Promise.all([
    readFile(new URL("../lib/bookings/reschedule.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/0014_consumer_booking_reschedule.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/bookings/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dal, /import "server-only"/);
  assert.match(dal, /readRequestHistoryIds\(historyToken\)/);
  assert.match(dal, /verifyRescheduleToken\(token\)/);
  assert.match(dal, /\.in\("request_id", ids\)/);
  assert.match(dal, /\.rpc\("reschedule_consumer_booking"/);
  assert.match(sql, /request_id = any\(p_authorized_request_ids\)/);
  assert.match(sql, /booked_for is distinct from p_expected_booked_for/);
  assert.match(sql, /consumer_rescheduled_at is distinct from p_expected_rescheduled_at/);
  assert.match(sql, /v_new_slot\.service_id is distinct from v_booking\.service_id/);
  assert.match(sql, /v_new_slot\.status <> 'available'/);
  assert.match(sql, /merchant_responded_at = null/);
  assert.match(sql, /set status = 'available'/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /\b(drop table|truncate table|delete from)\b/i);
  assert.match(page, /Confirm new time/);
  assert.match(page, /Keep current time/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});
