import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsOverview } from "../app/components/analytics-overview.tsx";
import { buildAnalyticsSummary } from "../lib/analytics/shared.ts";
import type { AnalyticsData } from "../types/analytics.ts";

const business = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Glow Studio",
};
const summary = buildAnalyticsSummary({
  business,
  range: "7d",
  now: new Date("2026-09-21T06:00:00.000Z"),
  bookings: [
    {
      status: "accepted",
      price: 95,
      currency: "AZN",
      createdAt: "2026-09-20T08:00:00.000Z",
      respondedAt: "2026-09-20T10:00:00.000Z",
      serviceId: "10000000-0000-4000-8000-000000000001",
      serviceName: "Hair + Makeup",
    },
    {
      status: "rejected",
      price: 95,
      currency: "AZN",
      createdAt: "2026-09-19T08:00:00.000Z",
      respondedAt: "2026-09-19T12:00:00.000Z",
      serviceId: "10000000-0000-4000-8000-000000000001",
      serviceName: "Hair + Makeup",
    },
  ],
});

const liveData: AnalyticsData = {
  source: "operations",
  liveData: true,
  analyticsAvailable: true,
  businesses: [business],
  selectedBusinessId: business.id,
  range: "7d",
  summary,
};

test("analytics overview renders metrics, trend and service performance", () => {
  const html = renderToStaticMarkup(
    createElement(AnalyticsOverview, { data: liveData }),
  );

  assert.match(html, /Live analytics/);
  assert.match(html, /Glow Studio/);
  assert.match(html, /Total leads/);
  assert.match(html, /Acceptance rate/);
  assert.match(html, /50%/);
  assert.match(html, /95 AZN/);
  assert.match(html, /Not collected revenue or payment/);
  assert.match(html, /Daily leads/);
  assert.match(html, /Top services by lead volume/);
  assert.match(html, /Hair \+ Makeup/);
  assert.match(html, /Customer identity/);
  assert.doesNotMatch(html, /original_request/);
  assert.doesNotMatch(html, /user_id/);
});

test("catalog analytics explicitly marks private metrics unavailable", () => {
  const html = renderToStaticMarkup(
    createElement(AnalyticsOverview, {
      data: {
        ...liveData,
        source: "catalog" as const,
        liveData: false,
        analyticsAvailable: false,
        summary: null,
      },
    }),
  );

  assert.match(html, /Analytics stay hidden in catalog mode/);
  assert.match(html, /AYLO_OPERATOR_TOKEN/);
  assert.match(html, /Public keys can only load the catalog/);
});
