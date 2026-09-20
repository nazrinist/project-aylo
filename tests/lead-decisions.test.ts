import assert from "node:assert/strict";
import test from "node:test";
import {
  LEAD_ACTION_TOKEN_TTL_MS,
  openLeadActionToken,
  sealLeadActionToken,
} from "../lib/leads/action-token-core.ts";
import { leadDecisionErrorDetails } from "../lib/leads/decision-errors.ts";
import {
  applyDemoLeadDecisions,
  type DemoLeadDecisionRecord,
} from "../lib/leads/shared.ts";
import {
  LeadDecisionInputSchema,
  type LeadInboxData,
  type LeadSummary,
} from "../types/lead.ts";

const bookingId = "40000000-0000-4000-8000-000000000001";
const businessId = "00000000-0000-4000-8000-000000000001";
const secret = "test-operator-secret-that-is-at-least-32-characters";
const now = Date.parse("2026-09-20T12:00:00.000Z");

test("lead decision input is strict and requires explicit confirmation", () => {
  const valid = {
    actionToken: "x".repeat(64),
    decision: "accepted" as const,
    confirmed: true as const,
  };

  assert.deepEqual(LeadDecisionInputSchema.parse(valid), valid);
  assert.equal(
    LeadDecisionInputSchema.safeParse({ ...valid, decision: "cancelled" }).success,
    false,
  );
  assert.equal(
    LeadDecisionInputSchema.safeParse({ ...valid, confirmed: false }).success,
    false,
  );
  assert.equal(
    LeadDecisionInputSchema.safeParse({ ...valid, bookingId }).success,
    false,
  );
});

test("lead action token is encrypted, authenticated, bound, and short-lived", () => {
  const token = sealLeadActionToken(
    { bookingId, businessId },
    secret,
    now,
    Buffer.alloc(12, 7),
  );
  const claims = openLeadActionToken(token, secret, now + 1_000);

  assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(token.includes(bookingId), false);
  assert.deepEqual(claims, {
    bookingId,
    businessId,
    status: "pending_confirmation",
    issuedAt: now,
    expiresAt: now + LEAD_ACTION_TOKEN_TTL_MS,
  });
  assert.equal(openLeadActionToken(token, `${secret}-wrong`, now), null);
  const replacement = token.endsWith("A") ? "B" : "A";
  assert.equal(
    openLeadActionToken(`${token.slice(0, -1)}${replacement}`, secret, now),
    null,
  );
  assert.equal(
    openLeadActionToken(token, secret, now + LEAD_ACTION_TOKEN_TTL_MS),
    null,
  );
});

test("database decision errors map to safe API responses", () => {
  assert.deepEqual(leadDecisionErrorDetails("LEAD_ALREADY_DECIDED"), {
    code: "LEAD_ALREADY_DECIDED",
    message: "This lead already has a different final decision.",
    status: 409,
  });
  assert.equal(
    leadDecisionErrorDetails("function missing", "PGRST202").code,
    "LEAD_DECISION_MIGRATION_REQUIRED",
  );
  assert.equal(
    leadDecisionErrorDetails("private database details").message.includes("private"),
    false,
  );
});

test("demo decisions update counts and move a lead between filters", () => {
  const pendingLead: LeadSummary = {
    reference: "DMO-0001-01",
    serviceName: "Hair + Makeup",
    bookedFor: "2026-09-22T14:00:00+04:00",
    price: 95,
    currency: "AZN",
    status: "pending_confirmation",
    receivedAt: "2026-09-20T11:00:00.000Z",
    actionToken: "demo:DMO-0001-01",
  };
  const decision: DemoLeadDecisionRecord = {
    businessId,
    lead: pendingLead,
    decision: "accepted",
  };
  const base: LeadInboxData = {
    source: "demo",
    liveData: false,
    leadsAvailable: true,
    businesses: [{ id: businessId, name: "Glow Studio" }],
    selectedBusinessId: businessId,
    filter: "pending_confirmation",
    counts: {
      all: 5,
      pending_confirmation: 2,
      accepted: 1,
      rejected: 1,
      cancelled: 1,
    },
    leads: [pendingLead],
    resultsLimited: false,
  };

  const pendingView = applyDemoLeadDecisions(base, [decision]);
  assert.equal(pendingView.leads.length, 0);
  assert.equal(pendingView.counts.pending_confirmation, 1);
  assert.equal(pendingView.counts.accepted, 2);
  assert.equal(pendingView.counts.all, 5);

  const acceptedView = applyDemoLeadDecisions(
    { ...base, filter: "accepted", leads: [] },
    [decision],
  );
  assert.equal(acceptedView.leads[0]?.reference, pendingLead.reference);
  assert.equal(acceptedView.leads[0]?.status, "accepted");
  assert.equal(acceptedView.leads[0]?.actionToken, null);
});
