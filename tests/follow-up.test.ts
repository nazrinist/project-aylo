import assert from "node:assert/strict";
import test from "node:test";
import type { Intent } from "../types/intent.ts";
import { demoIntent } from "../lib/ai/intent.ts";
import {
  nextFollowUpQuestion,
  normalizeMissingFields,
  requiredMissingFields,
} from "../lib/intent/follow-up.ts";

const completeIntent: Intent = {
  category: "beauty",
  services: ["hair"],
  location: "Ağ Şəhər, Bakı",
  date: "2026-09-21",
  time_from: null,
  time_to: null,
  budget_min: null,
  budget_max: null,
  currency: "AZN",
  missing_fields: [],
  original_request: "test",
};

test("required fields use a stable question order", () => {
  const incomplete = {
    ...completeIntent,
    services: [],
    location: null,
    date: null,
  };
  assert.deepEqual(requiredMissingFields(incomplete), ["services", "location", "date"]);
  assert.equal(nextFollowUpQuestion(incomplete)?.field, "services");
});

test("the next missing field is asked after earlier answers", () => {
  const missingLocation = { ...completeIntent, location: null, date: null };
  assert.equal(nextFollowUpQuestion(missingLocation)?.field, "location");

  const missingDate = { ...completeIntent, date: null };
  assert.equal(nextFollowUpQuestion(missingDate)?.field, "date");
});

test("complete intents do not trigger a follow-up", () => {
  assert.deepEqual(requiredMissingFields(completeIntent), []);
  assert.equal(nextFollowUpQuestion(completeIntent), null);
});

test("model-provided missing fields are replaced by deterministic checks", () => {
  const normalized = normalizeMissingFields({
    ...completeIntent,
    location: null,
    missing_fields: ["budget", "time"],
  });
  assert.deepEqual(normalized.missing_fields, ["location"]);
});

test("demo parsing completes a multi-step follow-up request", () => {
  const first = demoIntent("Saç düzümü istəyirəm.");
  assert.deepEqual(first.missing_fields, ["location", "date"]);

  const second = demoIntent("Saç düzümü istəyirəm.\nlocation: Xətai");
  assert.deepEqual(second.missing_fields, ["date"]);

  const complete = demoIntent(
    "Saç düzümü istəyirəm.\nlocation: Xətai\ndate: 2026-09-21",
  );
  assert.deepEqual(complete.missing_fields, []);
  assert.equal(complete.date, "2026-09-21");
  assert.equal(complete.time_from, null);
});
