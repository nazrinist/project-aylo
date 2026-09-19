import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonHighlights,
  selectedComparisonResults,
  toggleComparisonSelection,
} from "../lib/search/comparison.ts";
import type { SearchResult } from "../types/search.ts";

function makeResult(
  id: string,
  {
    matchScore = 90,
    price = 100,
    time = 20,
    rating = 4.5,
  }: {
    matchScore?: number;
    price?: number;
    time?: number;
    rating?: number | null;
  } = {},
): SearchResult {
  return {
    id,
    businessId: `business-${id}`,
    businessName: `Studio ${id.toUpperCase()}`,
    serviceId: `service-${id}`,
    serviceName: "Hair + Makeup",
    address: "Bakı",
    price,
    currency: "AZN",
    durationMinutes: 90,
    rating,
    verified: true,
    availableTime: "2026-09-20T18:00:00+04:00",
    matchScore,
    scoreBreakdown: {
      service: 35,
      time,
      budget: 15,
      rating: 10,
      location: 5,
      verified: 5,
      total: matchScore,
    },
    reasons: ["Matches request"],
  };
}

test("comparison selection toggles offers and enforces the three-offer limit", () => {
  let selected: string[] = [];
  selected = toggleComparisonSelection(selected, "a");
  selected = toggleComparisonSelection(selected, "b");
  selected = toggleComparisonSelection(selected, "c");

  assert.deepEqual(selected, ["a", "b", "c"]);
  assert.deepEqual(toggleComparisonSelection(selected, "d"), ["a", "b", "c"]);
  assert.deepEqual(toggleComparisonSelection(selected, "b"), ["a", "c"]);
});

test("selected comparison results keep the ranked result order", () => {
  const results = [makeResult("a"), makeResult("b"), makeResult("c")];
  assert.deepEqual(
    selectedComparisonResults(results, ["c", "a"]).map(({ id }) => id),
    ["a", "c"],
  );
});

test("comparison highlights include ties and ignore missing ratings", () => {
  const results = [
    makeResult("a", { matchScore: 95, price: 90, time: 25, rating: null }),
    makeResult("b", { matchScore: 95, price: 80, time: 20, rating: 4.9 }),
    makeResult("c", { matchScore: 91, price: 80, time: 25, rating: 4.9 }),
  ];

  assert.deepEqual(comparisonHighlights(results), {
    bestScoreIds: ["a", "b"],
    lowestPriceIds: ["b", "c"],
    bestTimeFitIds: ["a", "c"],
    topRatingIds: ["b", "c"],
  });

  assert.deepEqual(
    comparisonHighlights([
      makeResult("a", { rating: null }),
      makeResult("b", { rating: null }),
    ]).topRatingIds,
    [],
  );
});
