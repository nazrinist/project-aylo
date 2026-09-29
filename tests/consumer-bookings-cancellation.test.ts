import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSUMER_BOOKING_CANCELLATION_TOKEN_TTL_MS,
  openConsumerBookingCancellationToken,
  sealConsumerBookingCancellationToken,
} from "../lib/bookings/cancellation-token-core.ts";
import { bookingCancellationErrorDetails } from "../lib/bookings/cancellation-errors.ts";
import { ConsumerBookingCancellationInputSchema } from "../types/booking.ts";

const bookingId = "40000000-0000-4000-8000-000000000001";
const secret = "day-32-consumer-cancellation-secret-is-long-enough";
const now = Date.parse("2026-09-29T08:00:00.000Z");

test("consumer cancellation input is strict and requires explicit confirmation", () => {
  const valid = {
    actionToken: "x".repeat(64),
    confirmed: true as const,
  };

  assert.deepEqual(ConsumerBookingCancellationInputSchema.parse(valid), valid);
  assert.equal(
    ConsumerBookingCancellationInputSchema.safeParse({ ...valid, confirmed: false }).success,
    false,
  );
  assert.equal(
    ConsumerBookingCancellationInputSchema.safeParse({ ...valid, bookingId }).success,
    false,
  );
  assert.equal(
    ConsumerBookingCancellationInputSchema.safeParse({ confirmed: true }).success,
    false,
  );
});

test("consumer cancellation token is opaque, authenticated, bound, and short-lived", () => {
  const token = sealConsumerBookingCancellationToken(
    bookingId,
    secret,
    now,
    Buffer.alloc(12, 32),
  );
  const claims = openConsumerBookingCancellationToken(token, secret, now + 1_000);

  assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(token.includes(bookingId), false);
  assert.deepEqual(claims, {
    bookingId,
    purpose: "consumer_booking_cancellation",
    issuedAt: now,
    expiresAt: now + CONSUMER_BOOKING_CANCELLATION_TOKEN_TTL_MS,
  });
  assert.equal(
    openConsumerBookingCancellationToken(token, `${secret}-wrong`, now),
    null,
  );
  const replacement = token.endsWith("A") ? "B" : "A";
  assert.equal(
    openConsumerBookingCancellationToken(
      `${token.slice(0, -1)}${replacement}`,
      secret,
      now,
    ),
    null,
  );
  assert.equal(
    openConsumerBookingCancellationToken(
      token,
      secret,
      now + CONSUMER_BOOKING_CANCELLATION_TOKEN_TTL_MS,
    ),
    null,
  );
});

test("database cancellation errors map to safe API responses", () => {
  assert.deepEqual(bookingCancellationErrorDetails("BOOKING_NOT_FOUND"), {
    code: "BOOKING_CANCELLATION_FORBIDDEN",
    message: "This cancellation action expired or changed. Refresh My bookings.",
    status: 403,
  });
  assert.deepEqual(bookingCancellationErrorDetails("BOOKING_NOT_CANCELLABLE"), {
    code: "BOOKING_NOT_CANCELLABLE",
    message: "This booking can no longer be cancelled.",
    status: 409,
  });
  assert.equal(
    bookingCancellationErrorDetails("function missing", "PGRST202").code,
    "BOOKING_CANCELLATION_MIGRATION_REQUIRED",
  );
  assert.equal(
    bookingCancellationErrorDetails("private database detail").message.includes("private"),
    false,
  );
});
