import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bookingErrorDetails } from "../lib/bookings/errors.ts";
import {
  signBookingOffer,
  verifyBookingOfferToken,
} from "../lib/bookings/offer-token.ts";
import { bookingClaimsFromResult } from "../lib/bookings/shared.ts";
import { BookingCreateInputSchema } from "../types/booking.ts";
import type { SearchResult } from "../types/search.ts";

const requestId = "20000000-0000-4000-8000-000000000001";
const result: SearchResult = {
  id: "30000000-0000-4000-8000-000000000001",
  businessId: "00000000-0000-4000-8000-000000000001",
  businessName: "Glow Studio",
  serviceId: "10000000-0000-4000-8000-000000000001",
  serviceName: "Hair + Makeup",
  address: "Ağ Şəhər, Bakı",
  price: 95,
  currency: "AZN",
  durationMinutes: 90,
  rating: 4.9,
  verified: true,
  availableTime: "2026-09-20T18:00:00+04:00",
  matchScore: 95.7,
  scoreBreakdown: {
    service: 35,
    time: 25,
    budget: 11,
    rating: 14.7,
    location: 5,
    verified: 5,
    total: 95.7,
  },
  reasons: ["Matches request"],
};

test("signed offer token binds request, slot, time, and price", () => {
  const claims = bookingClaimsFromResult(requestId, result);
  const token = signBookingOffer(claims, "test-booking-secret");

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(
    verifyBookingOfferToken(claims, token, "test-booking-secret"),
    true,
  );
  assert.equal(
    verifyBookingOfferToken(
      { ...claims, expectedPrice: claims.expectedPrice + 1 },
      token,
      "test-booking-secret",
    ),
    false,
  );
  for (const tampered of [
    { ...claims, requestId: "20000000-0000-4000-8000-000000000002" },
    { ...claims, availabilityId: "30000000-0000-4000-8000-000000000002" },
    { ...claims, bookedFor: "2026-09-20T19:00:00+04:00" },
    { ...claims, expectedCurrency: "USD" },
  ]) {
    assert.equal(
      verifyBookingOfferToken(tampered, token, "test-booking-secret"),
      false,
    );
  }
  assert.equal(verifyBookingOfferToken(claims, token, "wrong-secret"), false);
  assert.equal(verifyBookingOfferToken(claims, "not-a-token", "test-booking-secret"), false);
});

test("booking API input is strict and requires explicit confirmation", () => {
  const claims = bookingClaimsFromResult(requestId, result);
  const bookingToken = signBookingOffer(claims, "test-booking-secret");
  const valid = { ...claims, bookingToken, userConfirmed: true as const };

  assert.deepEqual(BookingCreateInputSchema.parse(valid), valid);
  assert.equal(
    BookingCreateInputSchema.safeParse({ ...valid, userConfirmed: false }).success,
    false,
  );
  assert.equal(
    BookingCreateInputSchema.safeParse({ ...valid, extra: "not allowed" }).success,
    false,
  );
});

test("database errors map to safe booking responses", () => {
  assert.deepEqual(bookingErrorDetails("SLOT_UNAVAILABLE"), {
    code: "SLOT_UNAVAILABLE",
    message: "This appointment time is no longer available",
    status: 409,
  });
  assert.equal(
    bookingErrorDetails("function missing", "PGRST202").code,
    "BOOKING_MIGRATION_REQUIRED",
  );
  assert.equal(bookingErrorDetails("internal details").message.includes("internal"), false);
});

test("booking migration locks rows and updates all lifecycle records atomically", () => {
  const sql = readFileSync(
    "supabase/migrations/0006_booking_persistence.sql",
    "utf8",
  );

  assert.match(sql, /for update;/gi);
  assert.match(sql, /bookings_availability_unique_idx/);
  assert.match(sql, /bookings_request_unique_idx/);
  assert.match(sql, /set status = 'booked'/);
  assert.match(sql, /set status = 'completed'/);
  assert.match(sql, /set search_path = pg_catalog, pg_temp/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
});
