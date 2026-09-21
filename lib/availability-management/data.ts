import "server-only";

import {
  AvailabilityAccessNotConfiguredError,
  AvailabilityBusinessNotFoundError,
  AvailabilityServiceNotFoundError,
  AvailabilityUnauthorizedError,
} from "@/lib/availability-management/errors";
import {
  AVAILABILITY_MANAGEMENT_LIMIT,
  buildAvailabilityCounts,
  buildAvailabilityWindow,
  catalogAvailabilityCounts,
  sortAvailabilitySlots,
} from "@/lib/availability-management/shared";
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
  AVAILABILITY_STATUSES,
  AvailabilityStatusSchema,
  type AvailabilityBusinessOption,
  type AvailabilityManagementData,
  type AvailabilityManagementQuery,
  type AvailabilityServiceOption,
  type AvailabilitySlotSummary,
  type AvailabilityStatus,
} from "@/types/availability";

type BusinessRow = { id: string; name: string };

type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number | null;
  active: boolean;
};

type SlotRow = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  services: { name: string } | { name: string }[] | null;
};

function relatedServiceName(value: SlotRow["services"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "Unknown service";
  return value?.name ?? "Unknown service";
}

function mapService(service: ServiceRow): AvailabilityServiceOption {
  return {
    id: service.id,
    businessId: service.business_id,
    name: service.name,
    durationMinutes: service.duration_minutes,
    active: service.active,
  };
}

function mapSlot(slot: SlotRow): AvailabilitySlotSummary {
  return {
    id: slot.id,
    businessId: slot.business_id,
    serviceId: slot.service_id,
    serviceName: relatedServiceName(slot.services),
    startTime: slot.start_time,
    endTime: slot.end_time,
    status: AvailabilityStatusSchema.parse(slot.status),
  };
}

function validateSelection(
  businesses: AvailabilityBusinessOption[],
  services: AvailabilityServiceOption[],
  query: AvailabilityManagementQuery,
) {
  const businessId = query.businessId ?? businesses[0]?.id ?? null;
  if (businessId && !businesses.some((business) => business.id === businessId)) {
    throw new AvailabilityBusinessNotFoundError();
  }
  if (
    query.serviceId &&
    !services.some(
      (service) =>
        service.id === query.serviceId && service.businessId === businessId,
    )
  ) {
    throw new AvailabilityServiceNotFoundError();
  }

  return { businessId, serviceId: query.serviceId ?? null };
}

function emptyData(
  source: AvailabilityManagementData["source"],
  query: AvailabilityManagementQuery,
  businesses: AvailabilityBusinessOption[],
  canManage: boolean,
  persistent: boolean,
): AvailabilityManagementData {
  return {
    source,
    liveData: source === "operations",
    canManage,
    persistent,
    businesses,
    services: [],
    selectedBusinessId: null,
    selectedServiceId: null,
    window: buildAvailabilityWindow(query.startDate),
    counts:
      source === "catalog"
        ? catalogAvailabilityCounts(0)
        : buildAvailabilityCounts([]),
    slots: [],
    resultsLimited: false,
  };
}

async function getOperationsData(
  query: AvailabilityManagementQuery,
): Promise<AvailabilityManagementData> {
  const supabase = getSupabaseAdminClient();
  const businessesResult = await supabase
    .from("businesses")
    .select("id,name")
    .order("name");
  if (businessesResult.error) throw new Error(businessesResult.error.message);

  const businesses = (businessesResult.data ?? []) as BusinessRow[];
  const businessId = query.businessId ?? businesses[0]?.id ?? null;
  if (!businessId) {
    return emptyData("operations", query, businesses, true, true);
  }
  if (!businesses.some((business) => business.id === businessId)) {
    throw new AvailabilityBusinessNotFoundError();
  }

  const servicesResult = await supabase
    .from("services")
    .select("id,business_id,name,duration_minutes,active")
    .eq("business_id", businessId)
    .order("active", { ascending: false })
    .order("name");
  if (servicesResult.error) throw new Error(servicesResult.error.message);
  const services = ((servicesResult.data ?? []) as ServiceRow[]).map(mapService);
  const selection = validateSelection(businesses, services, {
    ...query,
    businessId,
  });
  const window = buildAvailabilityWindow(query.startDate);

  let slotsQuery = supabase
    .from("availability")
    .select(
      "id,business_id,service_id,start_time,end_time,status,services!inner(name)",
    )
    .eq("business_id", businessId)
    .gte("start_time", window.start)
    .lt("start_time", window.end)
    .order("start_time")
    .limit(AVAILABILITY_MANAGEMENT_LIMIT);
  if (selection.serviceId) {
    slotsQuery = slotsQuery.eq("service_id", selection.serviceId);
  }

  const countQuery = (status?: AvailabilityStatus) => {
    let builder = supabase
      .from("availability")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("start_time", window.start)
      .lt("start_time", window.end);
    if (selection.serviceId) builder = builder.eq("service_id", selection.serviceId);
    if (status) builder = builder.eq("status", status);
    return builder;
  };

  const [slotsResult, allCountResult, ...statusCountResults] = await Promise.all([
    slotsQuery,
    countQuery(),
    ...AVAILABILITY_STATUSES.map((status) => countQuery(status)),
  ]);
  for (const error of [
    slotsResult.error,
    allCountResult.error,
    ...statusCountResults.map((result) => result.error),
  ]) {
    if (error) throw new Error(error.message);
  }

  const counts = {
    all: allCountResult.count ?? 0,
    available: statusCountResults[0]?.count ?? 0,
    held: statusCountResults[1]?.count ?? 0,
    booked: statusCountResults[2]?.count ?? 0,
    blocked: statusCountResults[3]?.count ?? 0,
  };

  return {
    source: "operations",
    liveData: true,
    canManage: true,
    persistent: true,
    businesses,
    services,
    selectedBusinessId: businessId,
    selectedServiceId: selection.serviceId,
    window,
    counts,
    slots: sortAvailabilitySlots(
      ((slotsResult.data ?? []) as unknown as SlotRow[]).map(mapSlot),
    ),
    resultsLimited: counts.all > AVAILABILITY_MANAGEMENT_LIMIT,
  };
}

async function getCatalogData(
  query: AvailabilityManagementQuery,
): Promise<AvailabilityManagementData> {
  const supabase = getSupabaseServerClient();
  const businessesResult = await supabase
    .from("businesses")
    .select("id,name")
    .order("name");
  if (businessesResult.error) throw new Error(businessesResult.error.message);

  const businesses = (businessesResult.data ?? []) as BusinessRow[];
  const businessId = query.businessId ?? businesses[0]?.id ?? null;
  if (!businessId) {
    return emptyData("catalog", query, businesses, false, false);
  }
  if (!businesses.some((business) => business.id === businessId)) {
    throw new AvailabilityBusinessNotFoundError();
  }

  const servicesResult = await supabase
    .from("services")
    .select("id,business_id,name,duration_minutes,active")
    .eq("business_id", businessId)
    .order("active", { ascending: false })
    .order("name");
  if (servicesResult.error) throw new Error(servicesResult.error.message);
  const services = ((servicesResult.data ?? []) as ServiceRow[]).map(mapService);
  const selection = validateSelection(businesses, services, {
    ...query,
    businessId,
  });
  const window = buildAvailabilityWindow(query.startDate);

  let slotsQuery = supabase
    .from("availability")
    .select(
      "id,business_id,service_id,start_time,end_time,status,services!inner(name)",
      { count: "exact" },
    )
    .eq("business_id", businessId)
    .eq("status", "available")
    .gte("start_time", window.start)
    .lt("start_time", window.end)
    .order("start_time")
    .limit(AVAILABILITY_MANAGEMENT_LIMIT);
  if (selection.serviceId) {
    slotsQuery = slotsQuery.eq("service_id", selection.serviceId);
  }
  const slotsResult = await slotsQuery;
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  return {
    source: "catalog",
    liveData: false,
    canManage: false,
    persistent: false,
    businesses,
    services,
    selectedBusinessId: businessId,
    selectedServiceId: selection.serviceId,
    window,
    counts: catalogAvailabilityCounts(slotsResult.count ?? 0),
    slots: sortAvailabilitySlots(
      ((slotsResult.data ?? []) as unknown as SlotRow[]).map(mapSlot),
    ),
    resultsLimited: (slotsResult.count ?? 0) > AVAILABILITY_MANAGEMENT_LIMIT,
  };
}

function demoBusinesses(): AvailabilityBusinessOption[] {
  const map = new Map<string, string>();
  for (const provider of DEMO_PROVIDER_CATALOG) {
    map.set(provider.businessId, provider.businessName);
  }
  return [...map].map(([id, name]) => ({ id, name })).sort(
    (left, right) => left.name.localeCompare(right.name, "en"),
  );
}

function demoServices(businessId: string): AvailabilityServiceOption[] {
  return DEMO_PROVIDER_CATALOG.filter(
    (provider) => provider.businessId === businessId,
  ).map((provider) => ({
    id: provider.serviceId,
    businessId: provider.businessId,
    name: provider.serviceName,
    durationMinutes: provider.durationMinutes,
    active: true,
  }));
}

function demoSlots(
  businessId: string,
  services: AvailabilityServiceOption[],
  startDate: string,
): AvailabilitySlotSummary[] {
  const statuses: AvailabilityStatus[] = [
    "available",
    "booked",
    "available",
    "blocked",
    "held",
    "available",
    "available",
    "blocked",
  ];
  const hours = [10, 14, 11, 15, 12, 16, 10, 14];
  if (services.length === 0) return [];

  return statuses.map((status, index) => {
    const service = services[index % services.length];
    const [year, month, day] = startDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + (index % 7)))
      .toISOString()
      .slice(0, 10);
    const startTime = `${date}T${String(hours[index]).padStart(2, "0")}:00:00+04:00`;
    const endTime = new Date(
      new Date(startTime).getTime() +
        (service.durationMinutes ?? 60) * 60 * 1000,
    ).toISOString();

    return {
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      businessId,
      serviceId: service.id,
      serviceName: service.name,
      startTime,
      endTime,
      status,
    };
  });
}

function getDemoData(
  query: AvailabilityManagementQuery,
): AvailabilityManagementData {
  const businesses = demoBusinesses();
  const businessId = query.businessId ?? businesses[0]?.id ?? null;
  if (!businessId) return emptyData("demo", query, businesses, true, false);
  if (!businesses.some((business) => business.id === businessId)) {
    throw new AvailabilityBusinessNotFoundError();
  }

  const services = demoServices(businessId);
  const selection = validateSelection(businesses, services, {
    ...query,
    businessId,
  });
  const allSlots = demoSlots(businessId, services, query.startDate);
  const slots = selection.serviceId
    ? allSlots.filter((slot) => slot.serviceId === selection.serviceId)
    : allSlots;

  return {
    source: "demo",
    liveData: false,
    canManage: true,
    persistent: false,
    businesses,
    services,
    selectedBusinessId: businessId,
    selectedServiceId: selection.serviceId,
    window: buildAvailabilityWindow(query.startDate),
    counts: buildAvailabilityCounts(slots),
    slots: sortAvailabilitySlots(slots),
    resultsLimited: false,
  };
}

export async function getAvailabilityManagementData(
  query: AvailabilityManagementQuery,
  authorization: string | null,
) {
  if (isSupabaseAdminConfigured()) {
    if (!isOperatorAccessConfigured()) {
      throw new AvailabilityAccessNotConfiguredError();
    }
    if (!verifyOperatorAuthorization(authorization)) {
      throw new AvailabilityUnauthorizedError();
    }
    return getOperationsData(query);
  }

  if (isSupabaseConfigured()) return getCatalogData(query);
  return getDemoData(query);
}
