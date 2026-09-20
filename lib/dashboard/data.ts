import "server-only";

import { buildDashboardSummary, buildDashboardWindow } from "@/lib/dashboard/shared";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  DashboardBusinessSummary,
  DashboardData,
  DashboardServiceSummary,
  DashboardSlotStatus,
  DashboardSlotSummary,
} from "@/types/dashboard";

type BusinessRow = {
  id: string;
  name: string;
  address: string | null;
  rating: number | string | null;
  verified: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number | string | null;
  currency: string;
  duration_minutes: number | null;
  active: boolean;
};

type SlotRow = {
  id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  services: { name: string } | { name: string }[] | null;
};

export class DashboardBusinessNotFoundError extends Error {
  constructor() {
    super("Business not found");
    this.name = "DashboardBusinessNotFoundError";
  }
}

function numberOrNull(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slotStatus(value: string): DashboardSlotStatus {
  if (
    value === "available" ||
    value === "held" ||
    value === "booked" ||
    value === "blocked"
  ) {
    return value;
  }

  return "blocked";
}

function relatedServiceName(value: SlotRow["services"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown service";
  return value?.name ?? "Unknown service";
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

function demoSlots(
  services: DashboardServiceSummary[],
  now: Date,
): DashboardSlotSummary[] {
  const schedule = [
    [1, 10],
    [1, 14],
    [2, 11],
    [2, 16],
    [3, 10],
    [3, 15],
  ] as const;

  if (services.length === 0) return [];

  return schedule.map(([days, hour], index) => {
    const service = services[index % services.length];
    const startTime = `${bakuDateAfter(now, days)}T${String(hour).padStart(2, "0")}:00:00+04:00`;
    const endTime = new Date(
      new Date(startTime).getTime() +
        (service.durationMinutes ?? 60) * 60 * 1000,
    ).toISOString();

    return {
      id: `demo-${service.id}-${days}-${hour}`,
      serviceId: service.id,
      serviceName: service.name,
      startTime,
      endTime,
      status: "available",
    };
  });
}

function getDemoDashboardData(
  selectedBusinessId: string | undefined,
  now: Date,
): DashboardData {
  const businessMap = new Map<string, (typeof DEMO_PROVIDER_CATALOG)[number]>();
  for (const provider of DEMO_PROVIDER_CATALOG) {
    if (!businessMap.has(provider.businessId)) {
      businessMap.set(provider.businessId, provider);
    }
  }

  const businesses = [...businessMap.values()]
    .map((provider) => ({ id: provider.businessId, name: provider.businessName }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const businessId = selectedBusinessId ?? businesses[0]?.id;

  if (!businessId) {
    return { source: "demo", privateMetrics: false, businesses, dashboard: null };
  }

  const provider = businessMap.get(businessId);
  if (!provider) throw new DashboardBusinessNotFoundError();

  const services: DashboardServiceSummary[] = DEMO_PROVIDER_CATALOG.filter(
    (candidate) => candidate.businessId === businessId,
  ).map((candidate) => ({
    id: candidate.serviceId,
    name: candidate.serviceName,
    price: candidate.price,
    currency: candidate.currency,
    durationMinutes: candidate.durationMinutes,
    active: true,
  }));
  const upcomingSlots = demoSlots(services, now);
  const business: DashboardBusinessSummary = {
    id: provider.businessId,
    name: provider.businessName,
    address: provider.address,
    rating: provider.rating,
    verified: provider.verified,
  };

  return {
    source: "demo",
    privateMetrics: false,
    businesses,
    dashboard: buildDashboardSummary({
      business,
      services,
      upcomingSlots,
      openSlotCount: upcomingSlots.length,
      pendingBookingCount: null,
      bookedSlotCount: null,
      now,
    }),
  };
}

export async function getDashboardData(
  selectedBusinessId?: string,
  now = new Date(),
): Promise<DashboardData> {
  const hasAdminAccess = isSupabaseAdminConfigured();

  if (!hasAdminAccess && !isSupabaseConfigured()) {
    return getDemoDashboardData(selectedBusinessId, now);
  }

  const supabase = hasAdminAccess
    ? getSupabaseAdminClient()
    : getSupabaseServerClient();
  const businessesResult = await supabase
    .from("businesses")
    .select("id,name,address,rating,verified")
    .order("name");

  if (businessesResult.error) throw new Error(businessesResult.error.message);

  const businessRows = (businessesResult.data ?? []) as BusinessRow[];
  const businesses = businessRows.map((business) => ({
    id: business.id,
    name: business.name,
  }));
  const businessId = selectedBusinessId ?? businesses[0]?.id;

  if (!businessId) {
    return {
      source: hasAdminAccess ? "operations" : "catalog",
      privateMetrics: hasAdminAccess,
      businesses,
      dashboard: null,
    };
  }

  const businessRow = businessRows.find((business) => business.id === businessId);
  if (!businessRow) throw new DashboardBusinessNotFoundError();

  const window = buildDashboardWindow(now);
  let slotsQuery = supabase
    .from("availability")
    .select("id,service_id,start_time,end_time,status,services!inner(name)")
    .eq("business_id", businessId)
    .gte("start_time", window.start)
    .lt("start_time", window.end)
    .order("start_time")
    .limit(8);

  if (!hasAdminAccess) slotsQuery = slotsQuery.eq("status", "available");

  const servicesQuery = supabase
    .from("services")
    .select("id,name,price,currency,duration_minutes,active")
    .eq("business_id", businessId)
    .order("name");
  const openSlotsQuery = supabase
    .from("availability")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "available")
    .gte("start_time", window.start)
    .lt("start_time", window.end);
  const pendingBookingsQuery = hasAdminAccess
    ? supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "pending_confirmation")
        .gte("booked_for", window.start)
        .lt("booked_for", window.end)
    : Promise.resolve({ count: null, error: null });
  const bookedSlotsQuery = hasAdminAccess
    ? supabase
        .from("availability")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "booked")
        .gte("start_time", window.start)
        .lt("start_time", window.end)
    : Promise.resolve({ count: null, error: null });

  const [
    servicesResult,
    slotsResult,
    openSlotsResult,
    pendingBookingsResult,
    bookedSlotsResult,
  ] = await Promise.all([
    servicesQuery,
    slotsQuery,
    openSlotsQuery,
    pendingBookingsQuery,
    bookedSlotsQuery,
  ]);

  for (const error of [
    servicesResult.error,
    slotsResult.error,
    openSlotsResult.error,
    pendingBookingsResult.error,
    bookedSlotsResult.error,
  ]) {
    if (error) throw new Error(error.message);
  }

  const services = ((servicesResult.data ?? []) as ServiceRow[]).map(
    (service): DashboardServiceSummary => ({
      id: service.id,
      name: service.name,
      price: numberOrNull(service.price),
      currency: service.currency,
      durationMinutes: service.duration_minutes,
      active: service.active,
    }),
  );
  const upcomingSlots = ((slotsResult.data ?? []) as unknown as SlotRow[]).map(
    (slot): DashboardSlotSummary => ({
      id: slot.id,
      serviceId: slot.service_id,
      serviceName: relatedServiceName(slot.services),
      startTime: slot.start_time,
      endTime: slot.end_time,
      status: slotStatus(slot.status),
    }),
  );
  const business: DashboardBusinessSummary = {
    id: businessRow.id,
    name: businessRow.name,
    address: businessRow.address,
    rating: numberOrNull(businessRow.rating),
    verified: businessRow.verified,
  };

  return {
    source: hasAdminAccess ? "operations" : "catalog",
    privateMetrics: hasAdminAccess,
    businesses,
    dashboard: buildDashboardSummary({
      business,
      services,
      upcomingSlots,
      openSlotCount: openSlotsResult.count ?? 0,
      pendingBookingCount: pendingBookingsResult.count,
      bookedSlotCount: bookedSlotsResult.count,
      now,
    }),
  };
}
