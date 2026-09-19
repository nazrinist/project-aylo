import assert from "node:assert/strict";
import test from "node:test";
import type { Intent } from "../types/intent.ts";
import type { RankableSearchResult } from "../types/search.ts";
import {
  rankSearchResults,
  RANKING_METADATA,
  RANKING_WEIGHTS,
  scoreSearchResult,
} from "../lib/search/ranking.ts";

const baseIntent: Intent = {
  category: "beauty",
  services: ["hair", "makeup"],
  location: "Ağ Şəhər, Bakı",
  date: "2026-09-20",
  time_from: "18:00",
  time_to: null,
  budget_min: null,
  budget_max: 120,
  currency: "AZN",
  missing_fields: [],
  original_request: "test",
};

const baseCandidate: RankableSearchResult = {
  id: "slot-glow",
  businessId: "business-glow",
  businessName: "Glow Studio",
  serviceId: "service-glow",
  serviceName: "Hair + Makeup",
  address: "Ağ Şəhər, Bakı",
  price: 95,
  currency: "AZN",
  durationMinutes: 90,
  rating: 4.9,
  verified: true,
  availableTime: "2026-09-20T18:00:00+04:00",
};

test("ranking v1 weights form a 100-point model", () => {
  assert.equal(
    Object.values(RANKING_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );
  assert.equal(RANKING_METADATA.version, "v1");
});

test("score breakdown is transparent and totals its factors", () => {
  const ranked = scoreSearchResult(baseCandidate, baseIntent);

  assert.deepEqual(ranked.scoreBreakdown, {
    service: 35,
    time: 25,
    budget: 11,
    rating: 14.7,
    location: 5,
    verified: 5,
    total: 95.7,
  });
  assert.equal(ranked.matchScore, ranked.scoreBreakdown.total);
  assert.deepEqual(ranked.reasons, [
    "All requested services match",
    "Exact preferred time",
    "Within budget",
  ]);
});

test("time, rating, verification, and budget affect ranking predictably", () => {
  const exact = scoreSearchResult(baseCandidate, baseIntent);
  const later = scoreSearchResult(
    { ...baseCandidate, id: "later", availableTime: "2026-09-20T19:00:00+04:00" },
    baseIntent,
  );
  const lowerRated = scoreSearchResult(
    { ...baseCandidate, id: "lower", rating: 3.9 },
    baseIntent,
  );
  const unverified = scoreSearchResult(
    { ...baseCandidate, id: "unverified", verified: false },
    baseIntent,
  );
  const atBudgetLimit = scoreSearchResult(
    { ...baseCandidate, id: "limit", price: 120 },
    baseIntent,
  );

  assert.equal(exact.scoreBreakdown.time - later.scoreBreakdown.time, 12.5);
  assert.equal(exact.scoreBreakdown.rating - lowerRated.scoreBreakdown.rating, 3);
  assert.equal(exact.scoreBreakdown.verified - unverified.scoreBreakdown.verified, 5);
  assert.ok(exact.scoreBreakdown.budget > atBudgetLimit.scoreBreakdown.budget);
});

test("missing time and budget preferences use neutral full points", () => {
  const intent = {
    ...baseIntent,
    time_from: null,
    time_to: null,
    budget_max: null,
  };
  const ranked = scoreSearchResult(baseCandidate, intent);

  assert.equal(ranked.scoreBreakdown.time, RANKING_WEIGHTS.time);
  assert.equal(ranked.scoreBreakdown.budget, RANKING_WEIGHTS.budget);
  assert.equal(
    ranked.reasons.some((reason) => reason.toLowerCase().includes("time")),
    false,
  );
});

test("ranking uses stable tie-breakers and respects its limit", () => {
  const neutralIntent = { ...baseIntent, budget_max: null };
  const expensive = {
    ...baseCandidate,
    id: "b",
    businessName: "Beta",
    price: 100,
  };
  const cheaper = {
    ...baseCandidate,
    id: "a",
    businessName: "Alpha",
    price: 90,
  };

  const ranked = rankSearchResults([expensive, cheaper], neutralIntent, 1);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "a");
});

test("scores are always bounded between zero and 100", () => {
  const ranked = scoreSearchResult(
    {
      ...baseCandidate,
      serviceName: "Unrelated",
      address: "Elsewhere",
      price: 999,
      rating: 9,
    },
    baseIntent,
  );

  assert.ok(ranked.matchScore >= 0);
  assert.ok(ranked.matchScore <= 100);
});
