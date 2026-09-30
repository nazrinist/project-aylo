import assert from "node:assert/strict";
import test from "node:test";
import {
  consumerBookingIsUpcoming,
  filterConsumerBookings,
} from "../lib/bookings/status.ts";
import type { ConsumerBooking } from "../types/booking.ts";

const now = Date.parse("2026-10-01T10:00:00Z");

function booking(reference: string, status: ConsumerBooking["status"], bookedFor: string): ConsumerBooking {
  return {
    reference,
    businessName: "Provider",
    serviceName: "Service",
    address: null,
    bookedFor,
    bookedUntil: null,
    durationMinutes: 60,
    price: 50,
    currency: "AZN",
    status,
    createdAt: "2026-09-30T10:00:00Z",
    merchantRespondedAt: null,
    cancellationToken: null,
    rescheduleToken: null,
  };
}

test("upcoming includes only future pending and accepted bookings", () => {
  const future = "2026-10-02T12:00:00Z";
  const past = "2026-09-30T12:00:00Z";
  assert.equal(consumerBookingIsUpcoming(booking("1", "pending_confirmation", future), now), true);
  assert.equal(consumerBookingIsUpcoming(booking("2", "accepted", future), now), true);
  for (const status of ["rejected", "cancelled", "unknown"] as const) {
    assert.equal(consumerBookingIsUpcoming(booking("3", status, future), now), false);
  }
  assert.equal(consumerBookingIsUpcoming(booking("4", "accepted", past), now), false);
  assert.equal(consumerBookingIsUpcoming(booking("5", "accepted", new Date(now).toISOString()), now), false);
  assert.equal(consumerBookingIsUpcoming(booking("6", "accepted", "invalid"), now), false);
});

test("filters partition the same browser list and order upcoming by appointment", () => {
  const entries = [
    booking("later", "accepted", "2026-10-06T10:00:00Z"),
    booking("cancelled", "cancelled", "2026-10-03T10:00:00Z"),
    booking("sooner", "pending_confirmation", "2026-10-02T10:00:00Z"),
    booking("past", "accepted", "2026-09-30T10:00:00Z"),
    booking("unknown", "unknown", "invalid"),
  ];

  assert.equal(filterConsumerBookings(entries, "all", now), entries);
  assert.deepEqual(filterConsumerBookings(entries, "upcoming", now).map((item) => item.reference), ["sooner", "later"]);
  assert.deepEqual(filterConsumerBookings(entries, "history", now).map((item) => item.reference), ["cancelled", "past", "unknown"]);
  assert.equal(entries[0].reference, "later", "filtering never mutates API order");
  assert.equal(
    filterConsumerBookings(entries, "upcoming", now).length +
    filterConsumerBookings(entries, "history", now).length,
    entries.length,
  );
});
