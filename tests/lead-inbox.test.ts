import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeadCounts,
  countRecord,
  filterLeads,
  sortLeads,
  unavailableLeadCounts,
} from "../lib/leads/shared.ts";
import { LeadQuerySchema } from "../types/lead.ts";
import type { LeadSummary } from "../types/lead.ts";

const businessId = "00000000-0000-4000-8000-000000000001";
const leads: LeadSummary[] = [
  {
    reference: "ACCEPTED",
    serviceName: "Makeup",
    bookedFor: "2026-09-22T14:00:00+04:00",
    price: 65,
    currency: "AZN",
    status: "accepted",
    receivedAt: "2026-09-20T12:00:00.000Z",
  },
  {
    reference: "NEW-OLDER",
    serviceName: "Hair + Makeup",
    bookedFor: "2026-09-23T10:00:00+04:00",
    price: 95,
    currency: "AZN",
    status: "pending_confirmation",
    receivedAt: "2026-09-19T12:00:00.000Z",
  },
  {
    reference: "NEW-LATEST",
    serviceName: "Hair styling",
    bookedFor: "2026-09-24T11:00:00+04:00",
    price: 50,
    currency: "AZN",
    status: "pending_confirmation",
    receivedAt: "2026-09-20T10:00:00.000Z",
  },
  {
    reference: "REJECTED",
    serviceName: "Manicure",
    bookedFor: "2026-09-25T12:00:00+04:00",
    price: 35,
    currency: "AZN",
    status: "rejected",
    receivedAt: "2026-09-18T12:00:00.000Z",
  },
];

test("lead query is strict and defaults to the new-lead queue", () => {
  assert.deepEqual(LeadQuerySchema.parse({}), {
    status: "pending_confirmation",
  });
  assert.deepEqual(
    LeadQuerySchema.parse({ businessId, status: "all" }),
    { businessId, status: "all" },
  );
  assert.equal(
    LeadQuerySchema.safeParse({ businessId: "bad", status: "all" }).success,
    false,
  );
  assert.equal(
    LeadQuerySchema.safeParse({ status: "waiting" }).success,
    false,
  );
  assert.equal(
    LeadQuerySchema.safeParse({ status: "all", extra: "no" }).success,
    false,
  );
});

test("lead counts and filters cover every booking status", () => {
  assert.deepEqual(buildLeadCounts(leads), {
    all: 4,
    pending_confirmation: 2,
    accepted: 1,
    rejected: 1,
    cancelled: 0,
  });
  assert.deepEqual(
    filterLeads(leads, "pending_confirmation").map((lead) => lead.reference),
    ["NEW-OLDER", "NEW-LATEST"],
  );
  assert.equal(filterLeads(leads, "all").length, 4);
  assert.deepEqual(unavailableLeadCounts(), {
    all: null,
    pending_confirmation: null,
    accepted: null,
    rejected: null,
    cancelled: null,
  });
});

test("new leads sort first and newest-first within the queue", () => {
  assert.deepEqual(
    sortLeads(leads).map((lead) => lead.reference),
    ["NEW-LATEST", "NEW-OLDER", "ACCEPTED", "REJECTED"],
  );
  assert.deepEqual(countRecord(8.9, [3.8, 2, -4, Number.NaN]), {
    all: 8,
    pending_confirmation: 3,
    accepted: 2,
    rejected: 0,
    cancelled: 0,
  });
});
