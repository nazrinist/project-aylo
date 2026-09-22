import type { RequestHistoryEntry, RequestHistoryStatus } from "@/types/history";

export type RequestHistoryRow = {
  id: string;
  original_request: string;
  services: unknown;
  location: string | null;
  budget_min: number | string | null;
  budget_max: number | string | null;
  currency: string;
  requested_date: string | null;
  time_from: string | null;
  time_to: string | null;
  status: string;
  result_count: number | string | null;
  created_at: string;
};

const knownStatuses = new Set<RequestHistoryStatus>([
  "new", "searched", "failed", "completed", "cancelled",
]);

function finiteNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resultCount(value: number | string | null) {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function services(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function time(value: string | null) {
  if (!value) return null;
  return value.match(/^([01]\d|2[0-3]):[0-5]\d/)?.[0] ?? null;
}

function status(value: string): RequestHistoryStatus {
  return knownStatuses.has(value as RequestHistoryStatus)
    ? value as RequestHistoryStatus
    : "unknown";
}

export function requestHistoryEntryFromRow(row: RequestHistoryRow): RequestHistoryEntry {
  return {
    reference: row.id.slice(0, 8).toUpperCase(),
    originalRequest: row.original_request,
    services: services(row.services),
    location: row.location,
    budgetMin: finiteNumber(row.budget_min),
    budgetMax: finiteNumber(row.budget_max),
    currency: row.currency.trim().toUpperCase() || "AZN",
    requestedDate: row.requested_date,
    timeFrom: time(row.time_from),
    timeTo: time(row.time_to),
    status: status(row.status),
    resultCount: resultCount(row.result_count),
    createdAt: row.created_at,
  };
}
