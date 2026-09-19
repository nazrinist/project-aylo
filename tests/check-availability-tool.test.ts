import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PROVIDER_CATALOG } from "../lib/search/demo-catalog.ts";
import {
  CHECK_AVAILABILITY_TOOL,
  CheckAvailabilityToolInputSchema,
} from "../lib/tools/check-availability-contract.ts";
import {
  buildDemoAvailabilitySlots,
  filterAvailabilitySlots,
} from "../lib/tools/check-availability-shared.ts";

const serviceIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000009",
  "10000000-0000-4000-8000-000000000013",
];

const baseInput = {
  service_ids: serviceIds,
  date: "2026-09-20",
  time_from: "18:00",
  time_to: null,
  limit: 20,
};

test("checkAvailability has a strict OpenAI function-tool contract", () => {
  assert.equal(CHECK_AVAILABILITY_TOOL.type, "function");
  assert.equal(CHECK_AVAILABILITY_TOOL.name, "checkAvailability");
  assert.equal(CHECK_AVAILABILITY_TOOL.strict, true);
  assert.equal(CHECK_AVAILABILITY_TOOL.parameters.additionalProperties, false);
  assert.deepEqual(CHECK_AVAILABILITY_TOOL.parameters.required, [
    "service_ids",
    "date",
    "time_from",
    "time_to",
    "limit",
  ]);
});

test("tool input validates dates, times, UUIDs, and unexpected fields", () => {
  assert.equal(CheckAvailabilityToolInputSchema.safeParse(baseInput).success, true);
  assert.equal(
    CheckAvailabilityToolInputSchema.safeParse({
      ...baseInput,
      date: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    CheckAvailabilityToolInputSchema.safeParse({
      ...baseInput,
      time_from: "25:00",
    }).success,
    false,
  );
  assert.equal(
    CheckAvailabilityToolInputSchema.safeParse({
      ...baseInput,
      service_ids: ["not-a-uuid"],
    }).success,
    false,
  );
  assert.equal(
    CheckAvailabilityToolInputSchema.safeParse({
      ...baseInput,
      unexpected: true,
    }).success,
    false,
  );
});

test("duplicate service IDs are normalized before execution", () => {
  const input = CheckAvailabilityToolInputSchema.parse({
    ...baseInput,
    service_ids: [serviceIds[0], serviceIds[0]],
  });
  assert.deepEqual(input.service_ids, [serviceIds[0]]);
});

test("demo availability returns stable slots inside the requested time window", () => {
  const input = CheckAvailabilityToolInputSchema.parse(baseInput);
  const slots = buildDemoAvailabilitySlots(DEMO_PROVIDER_CATALOG, input);

  assert.equal(slots.length, 3);
  assert.deepEqual(
    slots.map((slot) => slot.serviceId),
    [...serviceIds].sort(),
  );
  assert.ok(slots.every((slot) => slot.startTime.endsWith("T18:00:00+04:00")));
  assert.ok(slots.every((slot) => slot.endTime.endsWith("+04:00")));
});

test("explicit and overnight windows are filtered deterministically", () => {
  const daytimeInput = CheckAvailabilityToolInputSchema.parse({
    ...baseInput,
    service_ids: [serviceIds[0]],
    time_from: "09:00",
    time_to: "14:00",
  });
  const daytime = buildDemoAvailabilitySlots(
    DEMO_PROVIDER_CATALOG,
    daytimeInput,
  );
  assert.deepEqual(
    daytime.map((slot) => slot.startTime.slice(11, 16)),
    ["10:00", "14:00"],
  );

  const overnightInput = CheckAvailabilityToolInputSchema.parse({
    ...baseInput,
    service_ids: [serviceIds[0]],
    time_from: "22:00",
    time_to: "02:00",
  });
  const overnight = filterAvailabilitySlots(
    [
      {
        id: "late",
        businessId: "business",
        serviceId: serviceIds[0],
        startTime: "2026-09-20T23:00:00+04:00",
        endTime: "2026-09-21T00:30:00+04:00",
      },
      {
        id: "early",
        businessId: "business",
        serviceId: serviceIds[0],
        startTime: "2026-09-20T01:00:00+04:00",
        endTime: "2026-09-20T02:30:00+04:00",
      },
      {
        id: "noon",
        businessId: "business",
        serviceId: serviceIds[0],
        startTime: "2026-09-20T12:00:00+04:00",
        endTime: "2026-09-20T13:30:00+04:00",
      },
    ],
    overnightInput,
  );
  assert.deepEqual(
    overnight.map((slot) => slot.id),
    ["early", "late"],
  );
});

test("availability results respect a stable limit", () => {
  const input = CheckAvailabilityToolInputSchema.parse({
    ...baseInput,
    time_from: null,
    limit: 2,
  });
  const slots = buildDemoAvailabilitySlots(
    [...DEMO_PROVIDER_CATALOG].reverse(),
    input,
  );

  assert.equal(slots.length, 2);
  assert.ok(slots.every((slot) => slot.startTime.endsWith("T10:00:00+04:00")));
  assert.deepEqual(
    slots.map((slot) => slot.serviceId),
    [...serviceIds].sort().slice(0, 2),
  );
});
