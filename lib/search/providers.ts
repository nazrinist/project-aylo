import "server-only";

import type { Intent } from "@/types/intent";
import type { SearchData, SearchResult } from "@/types/search";
import { executeCheckAvailabilityTool } from "@/lib/tools/check-availability";
import { executeSearchProvidersTool } from "@/lib/tools/search-providers";
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

  if (catalog.providers.length === 0) {
    return { source: catalog.source, appliedFilters: filters, results: [] };
  }

  const date = requestedDate(intent);
  const availability = await executeCheckAvailabilityTool({
    service_ids: catalog.providers.map((provider) => provider.serviceId),
    date,
    time_from: intent.time_from,
    time_to: intent.time_to,
    limit: 500,
  });

  const servicesById = new Map(
    catalog.providers.map((provider) => [provider.serviceId, provider]),
  );
  const results = availability.slots
    .map((slot): SearchResult | null => {
      const service = servicesById.get(slot.serviceId);
      if (!service) return null;
      const price = service.price;
      const rating = service.rating;
      const coverage = serviceCoverage(service.serviceName, intent.services);
      const locationMatch = locationMatches(service.address, intent.location);
      const timeDistance = timeDistanceMinutes(slot.startTime, intent);

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
        availableTime: slot.startTime,
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

  return { source: catalog.source, appliedFilters: filters, results };
}
