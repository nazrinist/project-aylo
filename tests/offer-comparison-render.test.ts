import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferComparison } from "../app/components/offer-comparison.tsx";
import type { SearchResult } from "../types/search.ts";

const weights = {
  service: 35,
  time: 25,
  budget: 15,
  rating: 15,
  location: 5,
  verified: 5,
};

function makeResult(
  id: string,
  businessName: string,
  matchScore: number,
  price: number,
): SearchResult {
  return {
    id,
    businessId: `business-${id}`,
    businessName,
    serviceId: `service-${id}`,
    serviceName: "Hair + Makeup",
    address: "Ağ Şəhər, Bakı",
    price,
    currency: "AZN",
    durationMinutes: 90,
    rating: id === "one" ? 4.9 : 4.7,
    verified: id === "one",
    availableTime: id === "one"
      ? "2026-09-20T18:00:00+04:00"
      : "2026-09-20T18:30:00+04:00",
    matchScore,
    scoreBreakdown: {
      service: 35,
      time: id === "one" ? 25 : 20,
      budget: id === "one" ? 12 : 15,
      rating: id === "one" ? 14 : 13,
      location: 5,
      verified: id === "one" ? 5 : 0,
      total: matchScore,
    },
    reasons: ["Matches request"],
  };
}

test("comparison renders selected offers, key metrics, and ranking factors", () => {
  const html = renderToStaticMarkup(
    createElement(OfferComparison, {
      results: [
        makeResult("one", "Glow Studio", 96, 95),
        makeResult("two", "Luna Beauty", 88, 80),
      ],
      weights,
      confirmedOfferId: null,
      onRemove: () => undefined,
      onClear: () => undefined,
      onBook: () => undefined,
    }),
  );

  assert.match(html, /Compare offers/);
  assert.match(html, /2 \/ 3 selected/);
  assert.match(html, /<table class="comparisonTable">/);
  assert.match(html, /Glow Studio/);
  assert.match(html, /Luna Beauty/);
  assert.match(html, /Best score/);
  assert.match(html, /Lowest/);
  assert.match(html, /Top rated/);
  assert.match(html, /Best time fit/);
  assert.match(html, /Ranking factors/);
  assert.match(html, /Clear all/);
  assert.equal((html.match(/Book offer/g) ?? []).length, 2);
  assert.equal(
    (html.match(/aria-label="Remove [^"]+ from comparison"/g) ?? []).length,
    4,
  );
});

test("one selected offer renders a prompt instead of an incomplete table", () => {
  const html = renderToStaticMarkup(
    createElement(OfferComparison, {
      results: [makeResult("one", "Glow Studio", 96, 95)],
      weights,
      confirmedOfferId: "one",
      onRemove: () => undefined,
      onClear: () => undefined,
      onBook: () => undefined,
    }),
  );

  assert.match(html, /Select one more offer/);
  assert.doesNotMatch(html, /<table/);
});
