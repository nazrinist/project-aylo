import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultCard } from "../app/components/result-card.tsx";
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
  reasons: [
    "All requested services match",
    "Exact preferred time",
    "Within budget",
  ],
};

const weights = {
  service: 35,
  time: 25,
  budget: 15,
  rating: 15,
  location: 5,
  verified: 5,
};

test("result card renders ranking, offer facts, and accessible score details", () => {
  const html = renderToStaticMarkup(
    createElement(ResultCard, {
      result,
      rank: 1,
      weights,
      selectedForCompare: true,
      compareDisabled: false,
      bookingState: "idle",
      bookingDisabled: false,
      onCompareToggle: () => undefined,
      onBook: () => undefined,
    }),
  );

  assert.match(html, /Best match/);
  assert.match(html, /✓ Verified/);
  assert.match(html, /95\.7/);
  assert.match(html, /95 AZN/);
  assert.match(html, /1 hr 30 min/);
  assert.match(html, /Why this match\?/);
  assert.match(html, /Service match/);
  assert.match(html, /✓ Added/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /resultCard featured compared/);
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 7);
  assert.match(html, /<button type="button">Book appointment<\/button>/);
});

test("result card shows the confirmed session state", () => {
  const html = renderToStaticMarkup(
    createElement(ResultCard, {
      result,
      rank: 2,
      weights,
      selectedForCompare: false,
      compareDisabled: false,
      bookingState: "saved",
      bookingDisabled: false,
      onCompareToggle: () => undefined,
      onBook: () => undefined,
    }),
  );

  assert.match(html, /✓ Slot booked · provider pending/);
  assert.match(html, /Review booking/);
});
