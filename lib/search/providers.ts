import "server-only";

import type { Intent } from "@/types/intent";
import type { SearchData, SearchResult } from "@/types/search";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { executeSearchProvidersTool } from "@/lib/tools/search-providers";
import { searchDemoProviders } from "./demo-providers";
import {
  appliedFilters,
  buildReasons,
  compareSearchResults,
  locationMatches,
  matchScore,
  requestedDate,
  resultMatchesFilters,
  serviceCoverage,
  timeDistanceMinutes,
} from "./shared";

type RawAvailability = {
  id: string;
  service_id: string;
  start_time: string;
};

export async function searchProviders(intent: Intent): Promise<SearchData> {
  const catalog = await executeSearchProvidersTool({
    category: intent.category,
    services: intent.services,
    location: intent.location,
    budget_min: intent.budget_min,
    budget_max: intent.budget_max,
    currency: intent.currency,
    limit: 250,
  });
  const filters = appliedFilters(intent);

  if (catalog.source === "demo") {
    return {
      source: "demo",
      appliedFilters: filters,
      results: searchDemoProviders(intent, catalog.providers),
    };
  }

  if (catalog.providers.length === 0) {
    return { source: "supabase", appliedFilters: filters, results: [] };
  }

  const supabase = getSupabaseServerClient();
  const date = requestedDate(intent);
  const dayStart = `${date}T00:00:00+04:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = `${next.toISOString().slice(0, 10)}T00:00:00+04:00`;

  const { data: availabilityRows, error: availabilityError } = await supabase
    .from("availability")
    .select("id,service_id,start_time")
    .in(
      "service_id",
      catalog.providers.map((provider) => provider.serviceId),
    )
    .eq("status", "available")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd)
    .limit(500);

  if (availabilityError) {
    throw new Error(`Availability search failed: ${availabilityError.message}`);
  }

  const servicesById = new Map(
    catalog.providers.map((provider) => [provider.serviceId, provider]),
  );
  const results = ((availabilityRows ?? []) as RawAvailability[])
    .map((slot): SearchResult | null => {
      const service = servicesById.get(slot.service_id);
      if (!service) return null;
      const price = service.price;
      const rating = service.rating;
      const coverage = serviceCoverage(service.serviceName, intent.services);
      const locationMatch = locationMatches(service.address, intent.location);
      const timeDistance = timeDistanceMinutes(slot.start_time, intent);

      return {
        id: slot.id,
        businessId: service.businessId,
        businessName: service.businessName,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        address: service.address,
        price,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
        rating,
        verified: service.verified,
        availableTime: slot.start_time,
        matchScore: matchScore({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          rating,
          locationMatch,
        }),
        reasons: buildReasons({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          verified: service.verified,
        }),
      };
    })
    .filter((result): result is SearchResult => Boolean(result))
    .filter((result) => resultMatchesFilters(result, intent))
    .sort(compareSearchResults)
    .slice(0, 6);

  return { source: "supabase", appliedFilters: filters, results };
}
