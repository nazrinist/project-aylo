import assert from "node:assert/strict";
import test from "node:test";
import { requestHistoryEntryFromRow } from "../lib/history/shared.ts";

test("private request rows map to a minimized browser history DTO", () => {
  const entry = requestHistoryEntryFromRow({
    id: "12345678-0000-4000-8000-000000000001",
    original_request: "Ağ Şəhərdə saç və makiyaj",
    services: [" hair ", "makeup", 42],
    location: "Ağ Şəhər, Bakı",
    budget_min: "80.00",
    budget_max: 120,
    currency: "azn",
    requested_date: "2026-09-22",
    time_from: "18:00:00",
    time_to: "20:00:00",
    status: "searched",
    result_count: "3",
    created_at: "2026-09-21T10:00:00.000Z",
  });
  assert.deepEqual(entry, {
    reference: "12345678",
    originalRequest: "Ağ Şəhərdə saç və makiyaj",
    services: ["hair", "makeup"],
    location: "Ağ Şəhər, Bakı",
    budgetMin: 80,
    budgetMax: 120,
    currency: "AZN",
    requestedDate: "2026-09-22",
    timeFrom: "18:00",
    timeTo: "20:00",
    status: "searched",
    resultCount: 3,
    createdAt: "2026-09-21T10:00:00.000Z",
  });
  assert.equal("id" in entry, false);
  assert.equal("userId" in entry, false);
});

test("history row mapping rejects malformed display values safely", () => {
  const entry = requestHistoryEntryFromRow({
    id: "abcdef12-0000-4000-8000-000000000001",
    original_request: "Nails",
    services: { name: "nails" },
    location: null,
    budget_min: "not-a-number",
    budget_max: null,
    currency: " ",
    requested_date: null,
    time_from: "99:99:00",
    time_to: null,
    status: "legacy-status",
    result_count: -1,
    created_at: "2026-09-21T10:00:00.000Z",
  });
  assert.deepEqual(entry.services, []);
  assert.equal(entry.budgetMin, null);
  assert.equal(entry.currency, "AZN");
  assert.equal(entry.timeFrom, null);
  assert.equal(entry.status, "unknown");
  assert.equal(entry.resultCount, null);
});
