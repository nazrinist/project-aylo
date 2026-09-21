import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDemoAvailabilityMutation,
  buildAvailabilityCounts,
  buildAvailabilityWindow,
  catalogAvailabilityCounts,
  filterAvailabilitySlots,
  isProtectedAvailabilityStatus,
} from "../lib/availability-management/shared.ts";
import {
  AvailabilityManagementQuerySchema,
  AvailabilityMutationInputSchema,
  BakuDateSchema,
  type AvailabilityServiceOption,
  type AvailabilitySlotSummary,
} from "../types/availability.ts";

const businessId = "00000000-0000-4000-8000-000000000001";
const serviceId = "10000000-0000-4000-8000-000000000001";
const secondServiceId = "10000000-0000-4000-8000-000000000002";
const mutationNow = new Date("2026-09-21T00:00:00.000Z");

const services: AvailabilityServiceOption[] = [
  {
    id: serviceId,
    businessId,
    name: "Hair + Makeup",
    durationMinutes: 60,
    active: true,
  },
  {
    id: secondServiceId,
    businessId,
    name: "Inactive service",
    durationMinutes: 60,
    active: false,
  },
];

const slots: AvailabilitySlotSummary[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    businessId,
    serviceId,
    serviceName: "Hair + Makeup",
    startTime: "2026-09-24T14:00:00+04:00",
    endTime: "2026-09-24T15:00:00+04:00",
    status: "booked",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    businessId,
    serviceId,
    serviceName: "Hair + Makeup",
    startTime: "2026-09-23T10:00:00+04:00",
    endTime: "2026-09-23T11:00:00+04:00",
    status: "available",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    businessId,
    serviceId,
    serviceName: "Hair + Makeup",
    startTime: "2026-09-25T12:00:00+04:00",
    endTime: "2026-09-25T13:00:00+04:00",
    status: "blocked",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    businessId,
    serviceId,
    serviceName: "Hair + Makeup",
    startTime: "2026-09-26T16:00:00+04:00",
    endTime: "2026-09-26T17:00:00+04:00",
    status: "held",
  },
];

test("Baku dates and seven-day windows are exact", () => {
  assert.equal(BakuDateSchema.safeParse("2026-02-29").success, false);
  assert.equal(BakuDateSchema.safeParse("2028-02-29").success, true);
  assert.deepEqual(buildAvailabilityWindow("2026-09-21"), {
    startDate: "2026-09-21",
    endDate: "2026-09-27",
    start: "2026-09-20T20:00:00.000Z",
    end: "2026-09-27T20:00:00.000Z",
    label: "2026-09-21 – 2026-09-27",
  });
});

test("management queries are strict and bind services to validated UUIDs", () => {
  assert.deepEqual(
    AvailabilityManagementQuerySchema.parse({ startDate: "2026-09-21" }),
    { startDate: "2026-09-21" },
  );
  assert.equal(
    AvailabilityManagementQuerySchema.safeParse({
      startDate: "2026-09-21",
      extra: "no",
    }).success,
    false,
  );
  assert.equal(
    AvailabilityManagementQuerySchema.safeParse({
      startDate: "2026-09-21",
      serviceId: "not-a-uuid",
    }).success,
    false,
  );
});

test("status counts, filters, and catalog unknowns stay honest", () => {
  assert.deepEqual(buildAvailabilityCounts(slots), {
    all: 4,
    available: 1,
    held: 1,
    booked: 1,
    blocked: 1,
  });
  assert.deepEqual(catalogAvailabilityCounts(3.9), {
    all: 3,
    available: 3,
    held: null,
    booked: null,
    blocked: null,
  });
  assert.deepEqual(
    filterAvailabilitySlots(slots, "available").map((slot) => slot.id),
    ["20000000-0000-4000-8000-000000000002"],
  );
  assert.deepEqual(
    filterAvailabilitySlots(slots, "all").map((slot) => slot.id),
    [
      "20000000-0000-4000-8000-000000000002",
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000003",
      "20000000-0000-4000-8000-000000000004",
    ],
  );
});

test("mutation input requires confirmation, valid windows, and no extra fields", () => {
  const create = {
    action: "create",
    businessId,
    serviceId,
    startTime: "2026-09-27T10:00:00+04:00",
    endTime: "2026-09-27T11:00:00+04:00",
    confirmed: true,
  } as const;
  assert.equal(AvailabilityMutationInputSchema.safeParse(create).success, true);
  assert.equal(
    AvailabilityMutationInputSchema.safeParse({ ...create, confirmed: false }).success,
    false,
  );
  assert.equal(
    AvailabilityMutationInputSchema.safeParse({
      ...create,
      endTime: create.startTime,
    }).success,
    false,
  );
  assert.equal(
    AvailabilityMutationInputSchema.safeParse({ ...create, unexpected: true }).success,
    false,
  );
});

test("demo mutations block overlaps and protect held or booked slots", () => {
  assert.equal(isProtectedAvailabilityStatus("held"), true);
  assert.equal(isProtectedAvailabilityStatus("booked"), true);
  assert.equal(isProtectedAvailabilityStatus("available"), false);

  assert.throws(
    () =>
      applyDemoAvailabilityMutation(slots, services, {
        action: "create",
        businessId,
        serviceId,
        startTime: "2026-09-23T10:30:00+04:00",
        endTime: "2026-09-23T11:30:00+04:00",
        confirmed: true,
      }, { now: mutationNow }),
    /overlapping active slot/,
  );

  assert.throws(
    () =>
      applyDemoAvailabilityMutation(slots, services, {
        action: "delete",
        slotId: "20000000-0000-4000-8000-000000000001",
        businessId,
        confirmed: true,
      }, { now: mutationNow }),
    /read-only/,
  );
});

test("demo block and reopen transitions update only the selected free slot", () => {
  const blocked = applyDemoAvailabilityMutation(slots, services, {
    action: "set_status",
    slotId: "20000000-0000-4000-8000-000000000002",
    businessId,
    targetStatus: "blocked",
    confirmed: true,
  }, { now: mutationNow });
  assert.equal(blocked.changed, true);
  assert.equal(blocked.slot?.status, "blocked");

  const reopened = applyDemoAvailabilityMutation(blocked.slots, services, {
    action: "set_status",
    slotId: "20000000-0000-4000-8000-000000000002",
    businessId,
    targetStatus: "available",
    confirmed: true,
  }, { now: mutationNow });
  assert.equal(reopened.changed, true);
  assert.equal(reopened.slot?.status, "available");

  const same = applyDemoAvailabilityMutation(reopened.slots, services, {
    action: "set_status",
    slotId: "20000000-0000-4000-8000-000000000002",
    businessId,
    targetStatus: "available",
    confirmed: true,
  }, { now: mutationNow });
  assert.equal(same.changed, false);
});
