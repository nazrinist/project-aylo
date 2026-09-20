import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadInbox } from "../app/components/lead-inbox.tsx";
import type { LeadInboxData } from "../types/lead.ts";

const liveInbox: LeadInboxData = {
  source: "operations",
  liveData: true,
  leadsAvailable: true,
  businesses: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Glow Studio",
    },
  ],
  selectedBusinessId: "00000000-0000-4000-8000-000000000001",
  filter: "pending_confirmation",
  counts: {
    all: 3,
    pending_confirmation: 1,
    accepted: 1,
    rejected: 1,
    cancelled: 0,
  },
  leads: [
    {
      reference: "4A90C2F1",
      serviceName: "Hair + Makeup",
      bookedFor: "2026-09-22T14:00:00+04:00",
      price: 95,
      currency: "AZN",
      status: "pending_confirmation",
      receivedAt: "2026-09-20T12:00:00.000Z",
      actionToken: "v1.test.action.token.that.is-long-enough",
    },
  ],
  resultsLimited: false,
};

test("lead inbox renders triage facts with explicit decision controls", () => {
  const html = renderToStaticMarkup(
    createElement(LeadInbox, {
      data: liveInbox,
      loading: false,
      decidingReference: null,
      onFilterChange: () => undefined,
      onDecisionRequest: () => undefined,
    }),
  );

  assert.match(html, /Live inbox/);
  assert.match(html, /Glow Studio/);
  assert.match(html, /Hair \+ Makeup/);
  assert.match(html, /95 AZN/);
  assert.match(html, /Ref · 4A90C2F1/);
  assert.match(html, /New lead/);
  assert.match(html, /Baku time/);
  assert.match(html, />Accept<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.doesNotMatch(html, /customer@example\.com/);
});

test("catalog mode clearly marks private leads unavailable", () => {
  const html = renderToStaticMarkup(
    createElement(LeadInbox, {
      data: {
        ...liveInbox,
        source: "catalog" as const,
        liveData: false,
        leadsAvailable: false,
        counts: {
          all: null,
          pending_confirmation: null,
          accepted: null,
          rejected: null,
          cancelled: null,
        },
        leads: [],
      },
      loading: false,
      decidingReference: null,
      onFilterChange: () => undefined,
      onDecisionRequest: () => undefined,
    }),
  );

  assert.match(html, /Catalog only/);
  assert.match(html, /Private data unavailable/);
  assert.match(html, /Live leads need server-side operator access/);
  assert.match(html, /AYLO_OPERATOR_TOKEN/);
});
