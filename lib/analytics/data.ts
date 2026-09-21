import "server-only";

import {
  AnalyticsAccessNotConfiguredError,
  AnalyticsBusinessNotFoundError,
  AnalyticsPrerequisiteMissingError,
  AnalyticsUnauthorizedError,
} from "@/lib/analytics/errors";
import {
  buildAnalyticsSummary,
  buildAnalyticsWindow,
} from "@/lib/analytics/shared";
import {
  isOperatorAccessConfigured,
  verifyOperatorAuthorization,
} from "@/lib/operator-access";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  AnalyticsBookingStatusSchema,
  type AnalyticsBookingInput,
  type AnalyticsBusinessOption,
  type AnalyticsData,
  type AnalyticsQuery,
} from "@/types/analytics";

const BOOKING_PAGE_SIZE = 1_000;

type BusinessRow = {
  id: string;
  name: string;
};

type BookingRow = {
  status: string;
  price: number | string | null;
  currency: string;
  created_at: string;
  merchant_responded_at: string | null;
  service_id: string | null;
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

function catalogBusinesses(): AnalyticsBusinessOption[] {
  const businesses = new Map<string, string>();
  for (const provider of DEMO_PROVIDER_CATALOG) {
    businesses.set(provider.businessId, provider.businessName);
  }

  return [...businesses]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function demoBookings(
  businessId: string,
  days: number,
  now: Date,
): AnalyticsBookingInput[] {
  const services = DEMO_PROVIDER_CATALOG.filter(
    (provider) => provider.businessId === businessId,
  );
  if (services.length === 0) return [];

  const statuses = [
    "accepted",
    "pending_confirmation",
    "accepted",
    "rejected",
    "cancelled",
  ] as const;
  const seed = Number.parseInt(businessId.slice(-3), 10) || 1;
  const bookings: AnalyticsBookingInput[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dailyCount = (dayIndex + seed) % 4;

    for (let leadIndex = 0; leadIndex < dailyCount; leadIndex += 1) {
      const service = services[(dayIndex + leadIndex) % services.length];
      const status = statuses[(dayIndex + leadIndex + seed) % statuses.length];
      const hoursAgo = dayIndex * 24 + leadIndex * 3 + 2;
      const createdAt = new Date(
        now.getTime() - hoursAgo * 60 * 60 * 1000,
      );
      const responseHours = 1 + ((dayIndex + leadIndex + seed) % 4);
      const respondedAt =
        status === "accepted" || status === "rejected"
          ? new Date(
              createdAt.getTime() + responseHours * 60 * 60 * 1000,
            ).toISOString()
          : null;

      bookings.push({
        status,
        price: service.price,
        currency: service.currency,
        createdAt: createdAt.toISOString(),
        respondedAt,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
      });
    }
  }

  return bookings;
}

function getDemoAnalytics(
  query: AnalyticsQuery,
  now: Date,
): AnalyticsData {
  const businesses = catalogBusinesses();
  const businessId = query.businessId ?? businesses[0]?.id ?? null;

  if (!businessId) {
    return {
      source: "demo",
      liveData: false,
      analyticsAvailable: true,
      businesses,
      selectedBusinessId: null,
      range: query.range,
      summary: null,
    };
  }

  const business = businesses.find((candidate) => candidate.id === businessId);
  if (!business) throw new AnalyticsBusinessNotFoundError();
  const window = buildAnalyticsWindow(query.range, now);

  return {
    source: "demo",
    liveData: false,
    analyticsAvailable: true,
    businesses,
    selectedBusinessId: businessId,
    range: query.range,
    summary: buildAnalyticsSummary({
      business,
      bookings: demoBookings(businessId, window.days, now),
      range: query.range,
      now,
    }),
  };
}

async function getCatalogAnalytics(
  query: AnalyticsQuery,
): Promise<AnalyticsData> {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("businesses").select("id,name").order("name");
  if (result.error) throw new Error(result.error.message);

  const businesses = (result.data ?? []) as BusinessRow[];
  const businessId = query.businessId ?? businesses[0]?.id ?? null;
  if (businessId && !businesses.some((business) => business.id === businessId)) {
    throw new AnalyticsBusinessNotFoundError();
  }

  return {
    source: "catalog",
    liveData: false,
    analyticsAvailable: false,
    businesses,
    selectedBusinessId: businessId,
    range: query.range,
    summary: null,
  };
}

async function loadBookingRows(
  businessId: string,
  start: string,
  end: string,
) {
  const supabase = getSupabaseAdminClient();
  const rows: BookingRow[] = [];

  for (let offset = 0; ; offset += BOOKING_PAGE_SIZE) {
    const result = await supabase
      .from("bookings")
      .select(
        "status,price,currency,created_at,merchant_responded_at,service_id,services(name)",
      )
      .eq("business_id", businessId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .range(offset, offset + BOOKING_PAGE_SIZE - 1);

    if (result.error) {
      if (result.error.message.includes("merchant_responded_at")) {
        throw new AnalyticsPrerequisiteMissingError();
      }
      throw new Error(result.error.message);
    }

    const page = (result.data ?? []) as unknown as BookingRow[];
    rows.push(...page);
    if (page.length < BOOKING_PAGE_SIZE) break;
  }

  return rows;
}

async function getOperationsAnalytics(
  query: AnalyticsQuery,
  now: Date,
): Promise<AnalyticsData> {
  const supabase = getSupabaseAdminClient();
  const businessesResult = await supabase
    .from("businesses")
    .select("id,name")
    .order("name");
  if (businessesResult.error) throw new Error(businessesResult.error.message);

  const businesses = (businessesResult.data ?? []) as BusinessRow[];
  const businessId = query.businessId ?? businesses[0]?.id ?? null;

  if (!businessId) {
    return {
      source: "operations",
      liveData: true,
      analyticsAvailable: true,
      businesses,
      selectedBusinessId: null,
      range: query.range,
      summary: null,
    };
  }

  const business = businesses.find((candidate) => candidate.id === businessId);
  if (!business) throw new AnalyticsBusinessNotFoundError();
  const window = buildAnalyticsWindow(query.range, now);
  const rows = await loadBookingRows(businessId, window.start, window.end);
  const bookings = rows.flatMap((row): AnalyticsBookingInput[] => {
    const status = AnalyticsBookingStatusSchema.safeParse(row.status);
    if (!status.success) return [];

    return [{
      status: status.data,
      price: numberOrNull(row.price),
      currency: row.currency,
      createdAt: row.created_at,
      respondedAt: row.merchant_responded_at,
      serviceId: row.service_id,
      serviceName: relatedServiceName(row.services),
    }];
  });

  return {
    source: "operations",
    liveData: true,
    analyticsAvailable: true,
    businesses,
    selectedBusinessId: businessId,
    range: query.range,
    summary: buildAnalyticsSummary({
      business,
      bookings,
      range: query.range,
      now,
    }),
  };
}

export async function getAnalyticsData(
  query: AnalyticsQuery,
  authorization: string | null,
  now = new Date(),
): Promise<AnalyticsData> {
  if (isSupabaseAdminConfigured()) {
    if (!isOperatorAccessConfigured()) {
      throw new AnalyticsAccessNotConfiguredError();
    }
    if (!verifyOperatorAuthorization(authorization)) {
      throw new AnalyticsUnauthorizedError();
    }
    return getOperationsAnalytics(query, now);
  }

  if (isSupabaseConfigured()) return getCatalogAnalytics(query);
  return getDemoAnalytics(query, now);
}
