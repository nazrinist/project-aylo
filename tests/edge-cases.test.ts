import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertCurrentSearchIntent,
  bakuDateTimeParts,
  SearchEdgeCaseError,
} from "../lib/search/edge-cases.ts";
import { timeMatches } from "../lib/search/shared.ts";
import { CheckAvailabilityToolInputSchema } from "../lib/tools/check-availability-contract.ts";
import {
  availabilityQueryBounds,
  filterAvailabilitySlots,
} from "../lib/tools/check-availability-shared.ts";
import { IntentSchema, type Intent } from "../types/intent.ts";

const serviceId = "10000000-0000-4000-8000-000000000001";
const validIntent: Intent = {
  category: "beauty",
  services: ["hair"],
  location: "Ağ Şəhər, Bakı",
  date: "2026-09-25",
  time_from: null,
  time_to: null,
  budget_min: null,
  budget_max: 120,
  currency: "AZN",
  missing_fields: [],
  original_request: "Sabah saç düzümü istəyirəm",
};

function hasEdgeCode(code: SearchEdgeCaseError["code"]) {
  return (error: unknown) =>
    error instanceof SearchEdgeCaseError && error.code === code;
}

test("intent boundary deduplicates supported services and rejects contradictory input", () => {
  const normalized = IntentSchema.parse({
    ...validIntent,
    services: ["hair", "hair", "makeup"],
  });
  assert.deepEqual(normalized.services, ["hair", "makeup"]);

  for (const invalid of [
    { ...validIntent, services: ["massage"] },
    { ...validIntent, category: "unknown", services: ["hair"] },
    { ...validIntent, budget_max: 1_000_001 },
    { ...validIntent, original_request: "   " },
  ]) {
    assert.equal(IntentSchema.safeParse(invalid).success, false);
  }
});

test("Baku date rollover and stale intent windows return stable errors", () => {
  const beforeMidnightUtc = new Date("2026-09-24T20:30:00.000Z");
  assert.deepEqual(bakuDateTimeParts(beforeMidnightUtc), {
    date: "2026-09-25",
    minutes: 30,
  });

  assert.throws(
    () => assertCurrentSearchIntent({ ...validIntent, date: "2026-09-24" }, beforeMidnightUtc),
    hasEdgeCode("SEARCH_DATE_PAST"),
  );

  const noonInBaku = new Date("2026-09-25T08:00:30.000Z");
  assert.throws(
    () => assertCurrentSearchIntent({
      ...validIntent,
      time_from: "10:00",
      time_to: "12:00",
    }, noonInBaku),
    hasEdgeCode("SEARCH_TIME_PAST"),
  );
  assert.doesNotThrow(() => assertCurrentSearchIntent({
    ...validIntent,
    time_from: "22:00",
    time_to: "02:00",
  }, noonInBaku));
});

test("unsupported and incomplete intents stop before provider execution", () => {
  const now = new Date("2026-09-24T08:00:00.000Z");
  assert.throws(
    () => assertCurrentSearchIntent({
      ...validIntent,
      category: "unknown",
      services: [],
    }, now),
    hasEdgeCode("SEARCH_CATEGORY_UNSUPPORTED"),
  );
  assert.throws(
    () => assertCurrentSearchIntent({ ...validIntent, location: null }, now),
    hasEdgeCode("SEARCH_INTENT_INCOMPLETE"),
  );
});

test("a preferred time never wraps to the opposite end of the selected day", () => {
  const window = { time_from: "00:30", time_to: null };
  assert.equal(timeMatches("2026-09-25T01:30:00+04:00", window), true);
  assert.equal(timeMatches("2026-09-25T23:30:00+04:00", window), false);
});

test("overnight database bounds and filtering cross into the next Baku day", () => {
  const input = CheckAvailabilityToolInputSchema.parse({
    service_ids: [serviceId],
    date: "2026-09-25",
    time_from: "22:00",
    time_to: "02:00",
    limit: 20,
  });
  assert.deepEqual(availabilityQueryBounds(input), {
    start: "2026-09-25T22:00:00+04:00",
    end: "2026-09-26T02:00:00+04:00",
    inclusiveEnd: true,
  });

  const slots = filterAvailabilitySlots([
    {
      id: "late",
      businessId: "business",
      serviceId,
      startTime: "2026-09-25T23:00:00+04:00",
      endTime: "2026-09-26T00:00:00+04:00",
    },
    {
      id: "early",
      businessId: "business",
      serviceId,
      startTime: "2026-09-26T01:00:00+04:00",
      endTime: "2026-09-26T02:00:00+04:00",
    },
    {
      id: "z-duplicate",
      businessId: "business",
      serviceId,
      startTime: "2026-09-26T01:00:00+04:00",
      endTime: "2026-09-26T02:00:00+04:00",
    },
    {
      id: "wrong-day",
      businessId: "business",
      serviceId,
      startTime: "2026-09-25T01:00:00+04:00",
      endTime: "2026-09-25T02:00:00+04:00",
    },
    {
      id: "outside-window",
      businessId: "business",
      serviceId,
      startTime: "2026-09-26T03:00:00+04:00",
      endTime: "2026-09-26T04:00:00+04:00",
    },
    {
      id: "invalid-duration",
      businessId: "business",
      serviceId,
      startTime: "2026-09-25T23:30:00+04:00",
      endTime: "2026-09-25T23:00:00+04:00",
    },
  ], input, new Date("2026-09-24T08:00:00.000Z"));

  assert.deepEqual(slots.map((slot) => slot.id), ["late", "early"]);
});

test("expired and malformed availability never reaches ranking or booking", () => {
  const input = CheckAvailabilityToolInputSchema.parse({
    service_ids: [serviceId],
    date: "2026-09-25",
    time_from: null,
    time_to: null,
    limit: 20,
  });
  const slots = filterAvailabilitySlots([
    {
      id: "expired",
      businessId: "business",
      serviceId,
      startTime: "2026-09-25T15:00:00+04:00",
      endTime: "2026-09-25T16:00:00+04:00",
    },
    {
      id: "future",
      businessId: "business",
      serviceId,
      startTime: "2026-09-25T18:00:00+04:00",
      endTime: "2026-09-25T19:00:00+04:00",
    },
    {
      id: "malformed",
      businessId: "business",
      serviceId,
      startTime: "not-a-date",
      endTime: "also-not-a-date",
    },
  ], input, new Date("2026-09-25T12:00:00.000Z"));

  assert.deepEqual(slots.map((slot) => slot.id), ["future"]);
});

test("API orchestration rejects edge cases before persistence and hides raw errors", async () => {
  const searchRoute = await readFile(
    new URL("../app/api/search/route.ts", import.meta.url),
    "utf8",
  );
  const availabilityRoute = await readFile(
    new URL("../app/api/tools/check-availability/route.ts", import.meta.url),
    "utf8",
  );
  const providers = await readFile(
    new URL("../lib/search/providers.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    searchRoute.indexOf("assertCurrentSearchIntent(intent, now)") <
      searchRoute.indexOf("createSearchRequest(intent)"),
  );
  assert.match(searchRoute, /error instanceof SearchEdgeCaseError/);
  assert.match(availabilityRoute, /AVAILABILITY_REQUEST_INVALID/);
  assert.doesNotMatch(availabilityRoute, /error\.message/);
  assert.match(providers, /slot\.businessId !== service\.businessId/);
});
