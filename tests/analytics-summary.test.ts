import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalyticsSummary,
  buildAnalyticsWindow,
} from "../lib/analytics/shared.ts";
import {
  AnalyticsQuerySchema,
  type AnalyticsBookingInput,
} from "../types/analytics.ts";

const business = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Glow Studio",
};
const hairService = "10000000-0000-4000-8000-000000000001";
const makeupService = "10000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-21T06:00:00.000Z");
const bookings: AnalyticsBookingInput[] = [
  {
    status: "accepted",
    price: 95,
    currency: "azn",
    createdAt: "2026-09-20T08:00:00.000Z",
    respondedAt: "2026-09-20T10:00:00.000Z",
    serviceId: hairService,
    serviceName: "Hair + Makeup",
  },
  {
    status: "rejected",
    price: 95,
    currency: "AZN",
    createdAt: "2026-09-19T08:00:00.000Z",
    respondedAt: "2026-09-19T13:00:00.000Z",
    serviceId: hairService,
    serviceName: "Hair + Makeup",
  },
  {
    status: "pending_confirmation",
    price: 65,
    currency: "AZN",
    createdAt: "2026-09-18T08:00:00.000Z",
    respondedAt: null,
    serviceId: makeupService,
    serviceName: "Makeup",
  },
  {
    status: "accepted",
    price: 65,
    currency: "AZN",
    createdAt: "2026-09-17T08:00:00.000Z",
    respondedAt: "2026-09-17T12:00:00.000Z",
    serviceId: makeupService,
    serviceName: "Makeup",
  },
  {
    status: "cancelled",
    price: 65,
    currency: "AZN",
    createdAt: "2026-09-16T08:00:00.000Z",
    respondedAt: null,
    serviceId: makeupService,
    serviceName: "Makeup",
  },
  {
    status: "accepted",
    price: 200,
    currency: "AZN",
    createdAt: "2026-09-14T10:00:00.000Z",
    respondedAt: "2026-09-14T11:00:00.000Z",
    serviceId: hairService,
    serviceName: "Hair + Makeup",
  },
];

test("analytics query accepts strict 7, 30 and 90 day ranges", () => {
  assert.deepEqual(AnalyticsQuerySchema.parse({}), { range: "30d" });
  assert.deepEqual(
    AnalyticsQuerySchema.parse({ businessId: business.id, range: "7d" }),
    { businessId: business.id, range: "7d" },
  );
  assert.equal(AnalyticsQuerySchema.safeParse({ range: "365d" }).success, false);
  assert.equal(
    AnalyticsQuerySchema.safeParse({ range: "30d", extra: "no" }).success,
    false,
  );
});

test("analytics window uses inclusive Baku calendar days", () => {
  assert.deepEqual(buildAnalyticsWindow("7d", now), {
    start: "2026-09-14T20:00:00.000Z",
    end: "2026-09-21T20:00:00.000Z",
    startDate: "2026-09-15",
    endDate: "2026-09-21",
    days: 7,
    label: "Last 7 days",
  });
  assert.throws(
    () => buildAnalyticsWindow("30d", new Date("invalid")),
    /valid date/,
  );
});

test("analytics summary computes honest decisions, value and response time", () => {
  const summary = buildAnalyticsSummary({
    business,
    bookings,
    range: "7d",
    now,
  });

  assert.deepEqual(summary.statusCounts, {
    all: 5,
    pendingConfirmation: 1,
    accepted: 2,
    rejected: 1,
    cancelled: 1,
  });
  assert.equal(summary.metrics.totalLeads, 5);
  assert.equal(summary.metrics.acceptedBookings, 2);
  assert.equal(summary.metrics.acceptanceRate, 66.7);
  assert.equal(summary.metrics.averageResponseHours, 3.7);
  assert.deepEqual(summary.metrics.acceptedValue, [
    { currency: "AZN", amount: 160 },
  ]);
  assert.equal(summary.dailyTrend.length, 7);
  assert.equal(
    summary.dailyTrend.reduce((total, point) => total + point.totalLeads, 0),
    5,
  );
  assert.equal(summary.services[0].serviceName, "Makeup");
  assert.equal(summary.services[0].totalLeads, 3);
  assert.equal(summary.services[1].acceptanceRate, 50);
});

test("analytics preserves unavailable ratios instead of inventing zero", () => {
  const summary = buildAnalyticsSummary({
    business,
    bookings: [
      {
        status: "pending_confirmation",
        price: null,
        currency: "AZN",
        createdAt: "2026-09-20T08:00:00.000Z",
        respondedAt: null,
        serviceId: makeupService,
        serviceName: "Makeup",
      },
    ],
    range: "7d",
    now,
  });

  assert.equal(summary.metrics.acceptanceRate, null);
  assert.equal(summary.metrics.averageResponseHours, null);
  assert.deepEqual(summary.metrics.acceptedValue, []);
});
