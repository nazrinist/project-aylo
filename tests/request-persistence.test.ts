import assert from "node:assert/strict";
import test from "node:test";
import type { Intent } from "../types/intent.ts";
import { requestInsertFromIntent } from "../lib/requests/shared.ts";

const intent: Intent = {
  category: "beauty",
  services: ["hair", "makeup"],
  location: "Ağ Şəhər, Bakı",
  date: "2026-09-21",
  time_from: "18:00",
  time_to: "20:00",
  budget_min: 80,
  budget_max: 120,
  currency: "AZN",
  missing_fields: [],
  original_request: "Sabah Ağ Şəhərdə saç və makiyaj istəyirəm",
};

test("normalized intent maps to a private request row", () => {
  assert.deepEqual(requestInsertFromIntent(intent), {
    original_request: intent.original_request,
    category: "beauty",
    services: ["hair", "makeup"],
    location: "Ağ Şəhər, Bakı",
    budget_min: 80,
    budget_max: 120,
    currency: "AZN",
    requested_date: "2026-09-21",
    time_from: "18:00",
    time_to: "20:00",
    status: "new",
  });
});

test("missing optional intent fields remain null", () => {
  const row = requestInsertFromIntent({
    ...intent,
    location: null,
    date: null,
    time_from: null,
    time_to: null,
    budget_min: null,
    budget_max: null,
  });

  assert.equal(row.location, null);
  assert.equal(row.requested_date, null);
  assert.equal(row.time_from, null);
  assert.equal(row.budget_max, null);
});
