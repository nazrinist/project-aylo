import assert from "node:assert/strict";
import test from "node:test";
import type { Intent } from "../types/intent.ts";
import { applySearchPreferences } from "../lib/preferences/shared.ts";

const intent: Intent = {
  category: "beauty",
  services: ["hair"],
  location: null,
  date: "2026-09-24",
  time_from: null,
  time_to: null,
  budget_min: null,
  budget_max: null,
  currency: "AZN",
  missing_fields: ["location"],
  original_request: "Sabah saç düzümü istəyirəm",
};
const preferences = { location: "Nərimanov, Bakı", budgetMax: 80, currency: "AZN" };

test("missing location and budget use saved preferences", () => {
  const merged = applySearchPreferences(intent, preferences);
  assert.equal(merged.intent.location, preferences.location);
  assert.equal(merged.intent.budget_max, preferences.budgetMax);
  assert.equal(merged.intent.currency, preferences.currency);
  assert.deepEqual(merged.intent.missing_fields, []);
  assert.deepEqual(merged.appliedPreferences, ["location", "budget_max"]);
});

test("values written in the request always win", () => {
  const explicit = { ...intent, location: "Xətai", budget_max: 200, currency: "USD" };
  const merged = applySearchPreferences(explicit, preferences);
  assert.equal(merged.intent.location, "Xətai");
  assert.equal(merged.intent.budget_max, 200);
  assert.equal(merged.intent.currency, "USD");
  assert.deepEqual(merged.appliedPreferences, []);
});

test("a minimum budget prevents an unrelated saved maximum", () => {
  const merged = applySearchPreferences({ ...intent, budget_min: 50 }, preferences);
  assert.equal(merged.intent.budget_min, 50);
  assert.equal(merged.intent.budget_max, null);
  assert.deepEqual(merged.appliedPreferences, ["location"]);
});
