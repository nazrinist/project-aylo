import assert from "node:assert/strict";
import test from "node:test";
import {
  consumerBookingCanCancel,
  consumerBookingFromRow,
  consumerBookingStatusText,
} from "../lib/bookings/status.ts";

test("booking rows map to a minimized consumer status DTO", () => {
  const booking = consumerBookingFromRow({
    id: "40000000-0000-4000-8000-000000000001",
    booked_for: "2026-10-02T18:00:00+04:00",
    price: "95.50",
    currency: "azn",
    status: "accepted",
    created_at: "2026-09-28T10:00:00.000Z",
    merchant_responded_at: "2026-09-28T10:05:00.000Z",
    businesses: {
      name: "  Glow Studio  ",
      address: " Ağ Şəhər, Bakı ",
    },
    services: [{ name: " Hair + Makeup ", duration_minutes: "90" }],
    availability: { end_time: "2026-10-02T19:45:00+04:00" },
  });

  assert.deepEqual(booking, {
    reference: "40000000",
    businessName: "Glow Studio",
    serviceName: "Hair + Makeup",
    address: "Ağ Şəhər, Bakı",
    bookedFor: "2026-10-02T18:00:00+04:00",
    bookedUntil: "2026-10-02T19:45:00+04:00",
    durationMinutes: 90,
    price: 95.5,
    currency: "AZN",
    status: "accepted",
    createdAt: "2026-09-28T10:00:00.000Z",
    merchantRespondedAt: "2026-09-28T10:05:00.000Z",
    cancellationToken: null,
    rescheduleToken: null,
  });
  assert.equal("id" in booking, false);
  assert.equal("requestId" in booking, false);
  assert.equal("businessId" in booking, false);
  assert.equal("serviceId" in booking, false);
  assert.equal("availabilityId" in booking, false);
});

test("malformed display values fall back without widening booking access", () => {
  const booking = consumerBookingFromRow({
    id: "abcdef12-0000-4000-8000-000000000001",
    booked_for: "not-a-date",
    price: -10,
    currency: "manat",
    status: "legacy_status",
    created_at: "not-a-date",
    merchant_responded_at: null,
    businesses: [],
    services: [{ name: " ", duration_minutes: 1_441 }],
    availability: { end_time: "invalid" },
  });

  assert.equal(booking.reference, "ABCDEF12");
  assert.equal(booking.businessName, "Unknown provider");
  assert.equal(booking.serviceName, "Unknown service");
  assert.equal(booking.address, null);
  assert.equal(booking.durationMinutes, null);
  assert.equal(booking.price, null);
  assert.equal(booking.currency, "AZN");
  assert.equal(booking.status, "unknown");
  assert.equal(booking.cancellationToken, null);
  assert.equal(booking.rescheduleToken, null);
  assert.equal(booking.bookedUntil, null);
});

test("only future pending or accepted bookings can expose a cancellation action", () => {
  const now = Date.parse("2026-09-29T08:00:00.000Z");
  const future = "2026-09-30T12:00:00.000Z";
  const past = "2026-09-28T12:00:00.000Z";

  assert.equal(consumerBookingCanCancel("pending_confirmation", future, now), true);
  assert.equal(consumerBookingCanCancel("accepted", future, now), true);
  assert.equal(consumerBookingCanCancel("rejected", future, now), false);
  assert.equal(consumerBookingCanCancel("cancelled", future, now), false);
  assert.equal(consumerBookingCanCancel("accepted", past, now), false);
  assert.equal(consumerBookingCanCancel("accepted", "invalid", now), false);
});

test("consumer-facing labels cover every booking lifecycle state", () => {
  assert.equal(consumerBookingStatusText("pending_confirmation").label, "Waiting for provider");
  assert.equal(consumerBookingStatusText("accepted").label, "Accepted");
  assert.equal(consumerBookingStatusText("rejected").label, "Not accepted");
  assert.equal(consumerBookingStatusText("cancelled").label, "Cancelled");
  assert.equal(consumerBookingStatusText("unknown").label, "Status unavailable");
});
