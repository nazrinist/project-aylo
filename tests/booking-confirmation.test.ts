import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmBookingDraft,
  createBookingDraft,
} from "../lib/bookings/confirmation.ts";
import { bookingInputFromConfirmation } from "../lib/bookings/shared.ts";
import type { BookableSearchResult } from "../types/search.ts";

const result: BookableSearchResult = {
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
  reasons: ["All requested services match"],
  bookingToken: "a".repeat(64),
};

test("booking draft snapshots the selected offer and saved request", () => {
  assert.deepEqual(createBookingDraft(result, "20000000-0000-4000-8000-000000000001"), {
    requestId: "20000000-0000-4000-8000-000000000001",
    bookingToken: "a".repeat(64),
    availabilityId: "30000000-0000-4000-8000-000000000001",
    businessId: "00000000-0000-4000-8000-000000000001",
    businessName: "Glow Studio",
    serviceId: "10000000-0000-4000-8000-000000000001",
    serviceName: "Hair + Makeup",
    address: "Ağ Şəhər, Bakı",
    bookedFor: "2026-09-20T18:00:00+04:00",
    durationMinutes: 90,
    price: 95,
    currency: "AZN",
  });
});

test("demo mode keeps a nullable request id without losing the slot", () => {
  const draft = createBookingDraft({ ...result, bookingToken: null }, null);
  assert.equal(draft.requestId, null);
  assert.equal(draft.bookingToken, null);
  assert.equal(draft.availabilityId, "30000000-0000-4000-8000-000000000001");
});

test("explicit confirmation adds a stable timestamp", () => {
  const draft = createBookingDraft(
    result,
    "20000000-0000-4000-8000-000000000001",
  );
  const confirmed = confirmBookingDraft(draft, "2026-09-19T20:00:00.000Z");

  assert.equal(confirmed.userConfirmed, true);
  assert.equal(confirmed.confirmedAt, "2026-09-19T20:00:00.000Z");
  assert.equal(confirmed.availabilityId, draft.availabilityId);
  assert.throws(
    () => confirmBookingDraft(draft, "not-a-date"),
    /valid confirmation timestamp/,
  );
});

test("confirmed live draft maps to the minimal booking API input", () => {
  const confirmation = confirmBookingDraft(
    createBookingDraft(result, "20000000-0000-4000-8000-000000000001"),
    "2026-09-19T20:00:00.000Z",
  );

  assert.deepEqual(bookingInputFromConfirmation(confirmation), {
    requestId: "20000000-0000-4000-8000-000000000001",
    availabilityId: "30000000-0000-4000-8000-000000000001",
    businessId: "00000000-0000-4000-8000-000000000001",
    serviceId: "10000000-0000-4000-8000-000000000001",
    bookedFor: "2026-09-20T18:00:00+04:00",
    expectedPrice: 95,
    expectedCurrency: "AZN",
    bookingToken: "a".repeat(64),
    userConfirmed: true,
  });
});
