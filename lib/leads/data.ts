import "server-only";

import { createLeadActionToken } from "@/lib/leads/action-token";
import {
  isLeadAccessConfigured,
  verifyLeadAuthorization,
} from "@/lib/leads/access";
import {
  buildLeadCounts,
  countRecord,
  filterLeads,
  LEAD_INBOX_LIMIT,
  sortLeads,
  unavailableLeadCounts,
} from "@/lib/leads/shared";
import {
  LeadAccessNotConfiguredError,
  LeadBusinessNotFoundError,
  LeadUnauthorizedError,
} from "@/lib/leads/errors";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  LEAD_STATUSES,
  LeadStatusSchema,
  type LeadBusinessOption,
  type LeadInboxData,
  type LeadQuery,
  type LeadStatus,
  type LeadSummary,
} from "@/types/lead";

type BusinessRow = {
  id: string;
  name: string;
};

type BookingRow = {
  id: string;
  booked_for: string;
  price: number | string | null;
  currency: string;
  status: string;
  created_at: string;
  services: { name: string } | { name: string }[] | null;
};

function numberOrNull(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function relatedServiceName(value: BookingRow["services"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown service";
  return value?.name ?? "Unknown service";
}

function businessesFromCatalog(): LeadBusinessOption[] {
  const businesses = new Map<string, string>();
  for (const provider of DEMO_PROVIDER_CATALOG) {
    businesses.set(provider.businessId, provider.businessName);
  }

  return [...businesses].map(([id, name]) => ({ id, name })).sort(
    (left, right) => left.name.localeCompare(right.name, "en"),
  );
}

function bakuDateAfter(now: Date, days: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const base = Date.UTC(
    Number(part("year")),
    Number(part("month")) - 1,
    Number(part("day")),
  );

  return new Date(base + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function demoLeads(businessId: string, now: Date): LeadSummary[] {
  const services = DEMO_PROVIDER_CATALOG.filter(
    (provider) => provider.businessId === businessId,
  );
  if (services.length === 0) return [];

  const statuses: LeadStatus[] = [
    "pending_confirmation",
    "pending_confirmation",
    "accepted",
    "rejected",
    "cancelled",
  ];
  const hours = [10, 14, 11, 16, 12];
  const receivedHoursAgo = [1, 8, 26, 54, 96];

  return statuses.map((status, index) => {
    const service = services[index % services.length];
    const reference = `DMO-${businessId.slice(-4)}-${String(index + 1).padStart(2, "0")}`;
    return {
      reference,
      serviceName: service.serviceName,
      bookedFor: `${bakuDateAfter(now, index + 1)}T${String(hours[index]).padStart(2, "0")}:00:00+04:00`,
      price: service.price,
      currency: service.currency,
      status,
      receivedAt: new Date(
        now.getTime() - receivedHoursAgo[index] * 60 * 60 * 1000,
      ).toISOString(),
      actionToken:
        status === "pending_confirmation" ? `demo:${reference}` : null,
    };
  });
}

function getDemoLeadInbox(filters: LeadQuery, now: Date): LeadInboxData {
  const businesses = businessesFromCatalog();
  const businessId = filters.businessId ?? businesses[0]?.id ?? null;

  if (!businessId) {
    return {
      source: "demo",
      liveData: false,
      leadsAvailable: true,
      businesses,
      selectedBusinessId: null,
      filter: filters.status,
      counts: buildLeadCounts([]),
      leads: [],
      resultsLimited: false,
    };
  }

  if (!businesses.some((business) => business.id === businessId)) {
    throw new LeadBusinessNotFoundError();
  }

  const allLeads = sortLeads(demoLeads(businessId, now));
  return {
    source: "demo",
    liveData: false,
    leadsAvailable: true,
    businesses,
    selectedBusinessId: businessId,
    filter: filters.status,
    counts: buildLeadCounts(allLeads),
    leads: filterLeads(allLeads, filters.status),
    resultsLimited: false,
  };
}

async function getCatalogLeadInbox(filters: LeadQuery): Promise<LeadInboxData> {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("businesses").select("id,name").order("name");
  if (result.error) throw new Error(result.error.message);

  const businesses = (result.data ?? []) as BusinessRow[];
  const businessId = filters.businessId ?? businesses[0]?.id ?? null;
  if (businessId && !businesses.some((business) => business.id === businessId)) {
    throw new LeadBusinessNotFoundError();
  }

  return {
    source: "catalog",
    liveData: false,
    leadsAvailable: false,
    businesses,
    selectedBusinessId: businessId,
    filter: filters.status,
    counts: unavailableLeadCounts(),
    leads: [],
    resultsLimited: false,
  };
}

async function getOperationsLeadInbox(filters: LeadQuery): Promise<LeadInboxData> {
  const supabase = getSupabaseAdminClient();
  const businessesResult = await supabase
    .from("businesses")
    .select("id,name")
    .order("name");
  if (businessesResult.error) throw new Error(businessesResult.error.message);

  const businesses = (businessesResult.data ?? []) as BusinessRow[];
  const businessId = filters.businessId ?? businesses[0]?.id ?? null;
  if (!businessId) {
    return {
      source: "operations",
      liveData: true,
      leadsAvailable: true,
      businesses,
      selectedBusinessId: null,
      filter: filters.status,
      counts: countRecord(0, []),
      leads: [],
      resultsLimited: false,
    };
  }

  if (!businesses.some((business) => business.id === businessId)) {
    throw new LeadBusinessNotFoundError();
  }

  let leadsQuery = supabase
    .from("bookings")
    .select("id,booked_for,price,currency,status,created_at,services(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(LEAD_INBOX_LIMIT);
  if (filters.status !== "all") {
    leadsQuery = leadsQuery.eq("status", filters.status);
  }

  const allCountQuery = supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  const statusCountQueries = LEAD_STATUSES.map((status) =>
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", status),
  );

  const [leadsResult, allCountResult, ...statusCountResults] = await Promise.all([
    leadsQuery,
    allCountQuery,
    ...statusCountQueries,
  ]);

  for (const error of [
    leadsResult.error,
    allCountResult.error,
    ...statusCountResults.map((result) => result.error),
  ]) {
    if (error) throw new Error(error.message);
  }

  const leads = ((leadsResult.data ?? []) as unknown as BookingRow[]).map(
    (booking): LeadSummary => {
      const status = LeadStatusSchema.parse(booking.status);
      return {
        reference: booking.id.slice(0, 8).toUpperCase(),
        serviceName: relatedServiceName(booking.services),
        bookedFor: booking.booked_for,
        price: numberOrNull(booking.price),
        currency: booking.currency,
        status,
        receivedAt: booking.created_at,
        actionToken:
          status === "pending_confirmation"
            ? createLeadActionToken(booking.id, businessId)
            : null,
      };
    },
  );
  const counts = countRecord(
    allCountResult.count ?? 0,
    statusCountResults.map((result) => result.count ?? 0),
  );
  const matchingCount = counts[filters.status] ?? 0;

  return {
    source: "operations",
    liveData: true,
    leadsAvailable: true,
    businesses,
    selectedBusinessId: businessId,
    filter: filters.status,
    counts,
    leads: sortLeads(leads),
    resultsLimited: matchingCount > LEAD_INBOX_LIMIT,
  };
}

export async function getLeadInboxData(
  filters: LeadQuery,
  authorization: string | null,
  now = new Date(),
): Promise<LeadInboxData> {
  if (isSupabaseAdminConfigured()) {
    if (!isLeadAccessConfigured()) throw new LeadAccessNotConfiguredError();
    if (!verifyLeadAuthorization(authorization)) throw new LeadUnauthorizedError();
    return getOperationsLeadInbox(filters);
  }

  if (isSupabaseConfigured()) return getCatalogLeadInbox(filters);
  return getDemoLeadInbox(filters, now);
}
