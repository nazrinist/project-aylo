import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingConfirmation } from "../app/components/booking-confirmation.tsx";
import {
  confirmBookingDraft,
  createBookingDraft,
} from "../lib/bookings/confirmation.ts";
import type { SearchResult } from "../types/search.ts";

const offer: SearchResult = {
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
};

test("booking review requires explicit acknowledgement and states its boundary", () => {
  const html = renderToStaticMarkup(
    createElement(BookingConfirmation, {
      offer,
      requestId: "request-1",
      confirmedBooking: null,
      onConfirm: () => undefined,
      onClose: () => undefined,
    }),
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Confirm booking details/);
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
      onConfirm: () => undefined,
      onClose: () => undefined,
    }),
  );

  assert.match(html, /Booking details confirmed/);
  assert.match(html, /Not booked or sent yet/);
  assert.match(html, /Day 16 will securely recheck this slot/);
  assert.doesNotMatch(html, /type="checkbox"/);
});
