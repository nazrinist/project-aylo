import assert from "node:assert/strict";
import test from "node:test";
import { IntentSchema } from "../types/intent.ts";

const validIntent = {
  category: "beauty",
  services: ["hair"],
  location: "Ağ Şəhər, Bakı",
  date: "2026-09-20",
  time_from: "18:00",
  time_to: null,
  budget_min: 50,
  budget_max: 120,
  currency: "azn",
  missing_fields: [],
  original_request: "test",
};

test("intent normalization uppercases currency", () => {
  assert.equal(IntentSchema.parse(validIntent).currency, "AZN");
});

test("invalid calendar dates and times are rejected", () => {
  assert.equal(IntentSchema.safeParse({ ...validIntent, date: "2026-02-31" }).success, false);
  assert.equal(IntentSchema.safeParse({ ...validIntent, time_from: "25:00" }).success, false);
});

test("minimum budget cannot exceed maximum budget", () => {
  assert.equal(
    IntentSchema.safeParse({ ...validIntent, budget_min: 121, budget_max: 120 }).success,
    false,
  );
});
