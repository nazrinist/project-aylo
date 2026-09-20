import {
  LEAD_STATUSES,
  type LeadDecision,
  type LeadCounts,
  type LeadFilter,
  type LeadInboxData,
  type LeadStatus,
  type LeadSummary,
} from "@/types/lead";

export const LEAD_INBOX_LIMIT = 50;

export type DemoLeadDecisionRecord = {
  businessId: string;
  lead: LeadSummary;
  decision: LeadDecision;
};

const statusPriority: Record<LeadStatus, number> = {
  pending_confirmation: 0,
  accepted: 1,
  rejected: 2,
  cancelled: 3,
};

function nonNegativeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function buildLeadCounts(leads: LeadSummary[]): LeadCounts {
  const counts: LeadCounts = {
    all: leads.length,
    pending_confirmation: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0,
  };

  for (const lead of leads) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1;
  }

  return counts;
}

export function unavailableLeadCounts(): LeadCounts {
  return {
    all: null,
    pending_confirmation: null,
    accepted: null,
    rejected: null,
    cancelled: null,
  };
}

export function filterLeads(leads: LeadSummary[], filter: LeadFilter) {
  return filter === "all"
    ? [...leads]
    : leads.filter((lead) => lead.status === filter);
}

export function sortLeads(leads: LeadSummary[]) {
  return [...leads].sort(
    (left, right) =>
      statusPriority[left.status] - statusPriority[right.status] ||
      right.receivedAt.localeCompare(left.receivedAt) ||
      left.reference.localeCompare(right.reference, "en"),
  );
}

export function countRecord(
  all: number,
  statusCounts: readonly number[],
): LeadCounts {
  const counts: LeadCounts = {
    all: nonNegativeCount(all),
    pending_confirmation: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0,
  };

  LEAD_STATUSES.forEach((status, index) => {
    counts[status] = nonNegativeCount(statusCounts[index] ?? 0);
  });

  return counts;
}

export function applyDemoLeadDecisions(
  data: LeadInboxData,
  decisions: readonly DemoLeadDecisionRecord[],
): LeadInboxData {
  if (data.source !== "demo" || !data.selectedBusinessId) return data;

  const counts = { ...data.counts };
  let leads = [...data.leads];

  for (const record of decisions) {
    if (
      record.businessId !== data.selectedBusinessId ||
      record.lead.status !== "pending_confirmation"
    ) {
      continue;
    }

    if (typeof counts.pending_confirmation === "number") {
      counts.pending_confirmation = Math.max(
        0,
        counts.pending_confirmation - 1,
      );
    }
    const decisionCount = counts[record.decision];
    if (typeof decisionCount === "number") {
      counts[record.decision] = decisionCount + 1;
    }

    const decidedLead: LeadSummary = {
      ...record.lead,
      status: record.decision,
      actionToken: null,
    };
    leads = leads.filter((lead) => lead.reference !== record.lead.reference);
    if (data.filter === "all" || data.filter === record.decision) {
      leads.push(decidedLead);
    }
  }

  return {
    ...data,
    counts,
    leads: sortLeads(leads),
  };
}
