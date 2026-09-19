import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDuration,
  matchLabel,
  providerInitials,
  scoreFactors,
} from "../lib/search/presentation.ts";

test("match labels use stable score bands", () => {
  assert.equal(matchLabel(95), "Excellent match");
  assert.equal(matchLabel(90), "Great match");
  assert.equal(matchLabel(80), "Strong match");
  assert.equal(matchLabel(79.9), "Good match");
});

test("provider initials are compact and have a safe fallback", () => {
  assert.equal(providerInitials("Nova Beauty House"), "NB");
  assert.equal(providerInitials(" Glow "), "G");
  assert.equal(providerInitials("   "), "AY");
});

test("service duration is formatted for cards", () => {
  assert.equal(formatDuration(null), "Flexible");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 hr");
  assert.equal(formatDuration(90), "1 hr 30 min");
});

test("score factor rows keep API order and clamp progress percentages", () => {
  const factors = scoreFactors(
    {
      service: 35,
      time: 30,
      budget: 11,
      rating: 14.7,
      location: 5,
      verified: -1,
      total: 94.7,
    },
    {
      service: 35,
      time: 25,
      budget: 15,
      rating: 15,
      location: 5,
      verified: 5,
    },
  );

  assert.deepEqual(
    factors.map((factor) => factor.key),
    ["service", "time", "budget", "rating", "location", "verified"],
  );
  assert.equal(factors[0].percentage, 100);
  assert.equal(factors[1].percentage, 100);
  assert.equal(factors[2].percentage, 73);
  assert.equal(factors[5].percentage, 0);
});
