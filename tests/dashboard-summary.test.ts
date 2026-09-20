import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardSummary,
  buildDashboardWindow,
} from "../lib/dashboard/shared.ts";
import { DashboardQuerySchema } from "../types/dashboard.ts";
import type {
  DashboardBusinessSummary,
  DashboardServiceSummary,
  DashboardSlotSummary,
} from "../types/dashboard.ts";

const now = new Date("2026-09-19T12:00:00.000Z");
const business: DashboardBusinessSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Glow Studio",
  address: "Ağ Şəhər, Bakı",
  rating: 4.9,
  verified: true,
};
const services: DashboardServiceSummary[] = [
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Makeup",
    price: 65,
    currency: "AZN",
    durationMinutes: 60,
    active: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Hair + Makeup",
    price: 95,
    currency: "AZN",
    durationMinutes: 90,
    active: true,
  },
];
const slots: DashboardSlotSummary[] = [
  {
    id: "slot-later",
    serviceId: services[0].id,
    serviceName: services[0].name,
    startTime: "2026-09-22T14:00:00+04:00",
    endTime: "2026-09-22T15:00:00+04:00",
    status: "available",
  },
  {
    id: "slot-first",
    serviceId: services[1].id,
    serviceName: services[1].name,
    startTime: "2026-09-21T10:00:00+04:00",
    endTime: "2026-09-21T11:30:00+04:00",
    status: "booked",
  },
];

test("dashboard query accepts one UUID and rejects unsupported input", () => {
  assert.deepEqual(
    DashboardQuerySchema.parse({ businessId: business.id }),
    { businessId: business.id },
  );
  assert.equal(
    DashboardQuerySchema.safeParse({ businessId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(
    DashboardQuerySchema.safeParse({ businessId: business.id, extra: "no" }).success,
    false,
  );
});

test("dashboard summary computes readiness and stable 30-day metrics", () => {
  const summary = buildDashboardSummary({
    business,
    services,
    upcomingSlots: slots,
    openSlotCount: 7,
    pendingBookingCount: 2,
    bookedSlotCount: 3,
    now,
  });

  assert.deepEqual(summary.window, {
    start: "2026-09-19T12:00:00.000Z",
    end: "2026-10-19T12:00:00.000Z",
    label: "Next 30 days",
  });
  assert.deepEqual(summary.metrics, {
    activeServices: 1,
    totalServices: 2,
    openSlots: 7,
    pendingBookings: 2,
    bookedSlots: 3,
  });
  assert.equal(summary.readiness.completed, 4);
  assert.equal(summary.readiness.total, 4);
  assert.equal(summary.services[0].name, "Hair + Makeup");
  assert.equal(summary.upcomingSlots[0].id, "slot-first");
});

test("public and demo summaries keep private metrics explicitly unavailable", () => {
  const summary = buildDashboardSummary({
    business: { ...business, address: null, verified: false },
    services: [],
    upcomingSlots: [],
    openSlotCount: 0,
    pendingBookingCount: null,
    bookedSlotCount: null,
    now,
  });

  assert.equal(summary.metrics.pendingBookings, null);
  assert.equal(summary.metrics.bookedSlots, null);
  assert.equal(summary.readiness.completed, 0);
  assert.deepEqual(
    summary.readiness.items.map((item) => item.complete),
    [false, false, false, false],
  );
  assert.throws(
    () => buildDashboardWindow(new Date("invalid")),
    /valid date/,
  );
});
