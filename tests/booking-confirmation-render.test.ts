import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingConfirmation } from "../app/components/booking-confirmation.tsx";
import {
  confirmBookingDraft,
  createBookingDraft,
} from "../lib/bookings/confirmation.ts";
import type { PersistedBooking } from "../types/booking.ts";
import type { BookableSearchResult } from "../types/search.ts";

const offer: BookableSearchResult = {
  id: "slot-1",
  businessId: "business-1",
  businessName: "Glow Studio",
  serviceId: "service-1",
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
  bookingToken: null,
};

test("booking review requires explicit acknowledgement and states its boundary", () => {
  const html = renderToStaticMarkup(
    createElement(BookingConfirmation, {
      offer,
      requestId: "request-1",
      confirmedBooking: null,
      persistedBooking: null,
      onConfirm: async () => ({ status: "local" as const, booking: null }),
      onClose: () => undefined,
    }),
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Confirm demo details/);
  assert.match(html, /Nothing is booked until you explicitly confirm/);
  assert.match(html, /Glow Studio/);
  assert.match(html, /Hair \+ Makeup/);
  assert.match(html, /95 AZN/);
  assert.match(html, /1 hr 30 min/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<button type="submit" disabled="">/);
  assert.match(html, /is not sent to the provider/);
});

test("confirmed view clearly distinguishes confirmation from persistence", () => {
  const confirmedBooking = confirmBookingDraft(
    createBookingDraft(offer, "request-1"),
    "2026-09-19T20:00:00.000Z",
  );
  const html = renderToStaticMarkup(
    createElement(BookingConfirmation, {
      offer,
      requestId: "request-1",
      confirmedBooking,
      persistedBooking: null,
      onConfirm: async () => ({ status: "local" as const, booking: null }),
      onClose: () => undefined,
    }),
  );

  assert.match(html, /Booking details confirmed/);
  assert.match(html, /Not saved in demo mode/);
  assert.doesNotMatch(html, /type="checkbox"/);
});

test("persisted view shows the booking status and reference", () => {
  const liveOffer = { ...offer, bookingToken: "a".repeat(64) };
  const confirmedBooking = confirmBookingDraft(
    createBookingDraft(liveOffer, "20000000-0000-4000-8000-000000000001"),
    "2026-09-19T20:00:00.000Z",
  );
  const persistedBooking: PersistedBooking = {
    id: "40000000-0000-4000-8000-000000000001",
    requestId: "20000000-0000-4000-8000-000000000001",
    availabilityId: offer.id,
    businessId: offer.businessId,
    serviceId: offer.serviceId,
    bookedFor: offer.availableTime,
    price: 95,
    currency: "AZN",
    status: "pending_confirmation",
    userConfirmedAt: "2026-09-19T20:00:01.000Z",
    createdAt: "2026-09-19T20:00:01.000Z",
  };
  const html = renderToStaticMarkup(
    createElement(BookingConfirmation, {
      offer: liveOffer,
      requestId: confirmedBooking.requestId,
      confirmedBooking,
      persistedBooking,
      onConfirm: async () => ({
        status: "saved" as const,
        booking: persistedBooking,
      }),
      onClose: () => undefined,
    }),
  );

  assert.match(html, /Booking request created/);
  assert.match(html, /Pending provider confirmation/);
  assert.match(html, /Reference · 40000000/);
});
