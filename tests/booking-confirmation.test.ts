import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmBookingDraft,
  createBookingDraft,
} from "../lib/bookings/confirmation.ts";
import type { SearchResult } from "../types/search.ts";

const result: SearchResult = {
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
  reasons: ["All requested services match"],
};

test("booking draft snapshots the selected offer and saved request", () => {
  assert.deepEqual(createBookingDraft(result, "request-1"), {
    requestId: "request-1",
    availabilityId: "slot-1",
    businessId: "business-1",
    businessName: "Glow Studio",
    serviceId: "service-1",
    serviceName: "Hair + Makeup",
    address: "Ağ Şəhər, Bakı",
    bookedFor: "2026-09-20T18:00:00+04:00",
    durationMinutes: 90,
    price: 95,
    currency: "AZN",
  });
});

test("demo mode keeps a nullable request id without losing the slot", () => {
  const draft = createBookingDraft(result, null);
  assert.equal(draft.requestId, null);
  assert.equal(draft.availabilityId, "slot-1");
});

test("explicit confirmation adds a stable timestamp", () => {
  const draft = createBookingDraft(result, "request-1");
  const confirmed = confirmBookingDraft(draft, "2026-09-19T20:00:00.000Z");

  assert.equal(confirmed.userConfirmed, true);
  assert.equal(confirmed.confirmedAt, "2026-09-19T20:00:00.000Z");
  assert.equal(confirmed.availabilityId, draft.availabilityId);
  assert.throws(
    () => confirmBookingDraft(draft, "not-a-date"),
    /valid confirmation timestamp/,
  );
});
