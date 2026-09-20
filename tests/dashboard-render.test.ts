import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardOverview } from "../app/components/dashboard-overview.tsx";
import { buildDashboardSummary } from "../lib/dashboard/shared.ts";

const summary = buildDashboardSummary({
  business: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Glow Studio",
    address: "Ağ Şəhər, Bakı",
    rating: 4.9,
    verified: true,
  },
  services: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Hair + Makeup",
      price: 95,
      currency: "AZN",
      durationMinutes: 90,
      active: true,
    },
  ],
  upcomingSlots: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      serviceId: "10000000-0000-4000-8000-000000000001",
      serviceName: "Hair + Makeup",
      startTime: "2026-09-21T10:00:00+04:00",
      endTime: "2026-09-21T11:30:00+04:00",
      status: "available",
    },
  ],
  openSlotCount: 6,
  pendingBookingCount: null,
  bookedSlotCount: null,
  now: new Date("2026-09-19T12:00:00.000Z"),
});

test("dashboard renders profile, readiness, services and upcoming slots", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardOverview, {
      summary,
      source: "demo" as const,
      privateMetrics: false,
    }),
  );

  assert.match(html, /Glow Studio/);
  assert.match(html, /Demo preview/);
  assert.match(html, /4 of 4 complete/);
  assert.match(html, /<progress value="4" max="4">/);
  assert.match(html, /Active services/);
  assert.match(html, /Open slots/);
  assert.match(html, /Hair \+ Makeup/);
  assert.match(html, /95 AZN/);
  assert.match(html, /Upcoming slots/);
  assert.match(html, /Unavailable in this data mode/);
  assert.match(html, /Lead inbox is ready/);
  assert.match(html, /Accept and reject actions arrive on Day 19/);
  assert.match(html, /href="\/leads"/);
});

test("dashboard view does not render private request fields", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardOverview, {
      summary,
      source: "catalog" as const,
      privateMetrics: false,
    }),
  );

  assert.doesNotMatch(html, /original_request/);
  assert.doesNotMatch(html, /user_id/);
  assert.doesNotMatch(html, /request text/i);
  assert.match(html, /Public catalog data only/);
});
