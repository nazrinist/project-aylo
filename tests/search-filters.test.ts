import assert from "node:assert/strict";
import test from "node:test";
import type { Intent } from "../types/intent.ts";
import {
  compareSearchResults,
  resultMatchesFilters,
  serviceCoverage,
  timeMatches,
} from "../lib/search/shared.ts";

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

const matchingResult = {
  serviceName: "Hair + Makeup",
  address: "Ağ Şəhər, Bakı",
  price: 95,
  currency: "AZN",
  availableTime: "2026-09-20T18:30:00+04:00",
};

test("all requested services must be covered", () => {
  assert.equal(serviceCoverage("Hair + Makeup", ["hair", "makeup"]), 1);
  assert.equal(serviceCoverage("Makeup", ["hair", "makeup"]), 0.5);
  assert.equal(
    resultMatchesFilters({ ...matchingResult, serviceName: "Makeup" }, baseIntent),
    false,
  );
});

test("location and budget limits are strict", () => {
  assert.equal(resultMatchesFilters(matchingResult, baseIntent), true);
  assert.equal(
    resultMatchesFilters({ ...matchingResult, address: "Xətai, Bakı" }, baseIntent),
    false,
  );
  assert.equal(
    resultMatchesFilters({ ...matchingResult, price: 121 }, baseIntent),
    false,
  );
  assert.equal(
    resultMatchesFilters(matchingResult, { ...baseIntent, budget_min: 100 }),
    false,
  );
});

test("a single requested time uses a deterministic 60-minute window", () => {
  assert.equal(timeMatches("2026-09-20T17:00:00+04:00", baseIntent), true);
  assert.equal(timeMatches("2026-09-20T19:00:00+04:00", baseIntent), true);
  assert.equal(timeMatches("2026-09-20T19:01:00+04:00", baseIntent), false);
});

test("explicit and overnight time windows are supported", () => {
  const daytime = { ...baseIntent, time_from: "10:00", time_to: "12:00" };
  assert.equal(timeMatches("2026-09-20T11:00:00+04:00", daytime), true);
  assert.equal(timeMatches("2026-09-20T13:00:00+04:00", daytime), false);

  const overnight = { ...baseIntent, time_from: "22:00", time_to: "02:00" };
  assert.equal(timeMatches("2026-09-20T23:00:00+04:00", overnight), true);
  assert.equal(timeMatches("2026-09-20T01:00:00+04:00", overnight), true);
  assert.equal(timeMatches("2026-09-20T12:00:00+04:00", overnight), false);
});

test("ranking has stable tie-breakers", () => {
  const later = {
    id: "b",
    businessName: "Beta",
    matchScore: 90,
    price: 100,
    availableTime: "2026-09-20T18:30:00+04:00",
  };
  const cheaper = {
    id: "a",
    businessName: "Alpha",
    matchScore: 90,
    price: 90,
    availableTime: "2026-09-20T19:00:00+04:00",
  };
  assert.deepEqual([later, cheaper].sort(compareSearchResults), [cheaper, later]);
});
