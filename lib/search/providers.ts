import "server-only";

import type { Intent } from "@/types/intent";
import type { RankableSearchResult, SearchData } from "@/types/search";
import { executeCheckAvailabilityTool } from "@/lib/tools/check-availability";
import { executeSearchProvidersTool } from "@/lib/tools/search-providers";
import { assertCurrentSearchIntent } from "./edge-cases";
import { rankSearchResults, RANKING_METADATA } from "./ranking";
import {
  appliedFilters,
  requestedDate,
  resultMatchesFilters,
} from "./shared";

export async function searchProviders(
  intent: Intent,
  now = new Date(),
): Promise<SearchData> {
  assertCurrentSearchIntent(intent, now);
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
    return {
      source: catalog.source,
      appliedFilters: filters,
      ranking: RANKING_METADATA,
      results: [],
    };
  }

  const date = requestedDate(intent);
  const availability = await executeCheckAvailabilityTool({
    service_ids: catalog.providers.map((provider) => provider.serviceId),
    date,
    time_from: intent.time_from,
    time_to: intent.time_to,
    limit: 500,
  }, now);

  const servicesById = new Map(
    catalog.providers.map((provider) => [provider.serviceId, provider]),
  );
  const eligibleResults = availability.slots
    .map((slot): RankableSearchResult | null => {
      const service = servicesById.get(slot.serviceId);
      if (!service || slot.businessId !== service.businessId) return null;

      return {
        id: slot.id,
        businessId: service.businessId,
        businessName: service.businessName,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        address: service.address,
        price: service.price,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
        rating: service.rating,
        verified: service.verified,
        availableTime: slot.startTime,
      };
    })
    .filter((result): result is RankableSearchResult => Boolean(result))
    .filter((result) => resultMatchesFilters(result, intent));
  const results = rankSearchResults(eligibleResults, intent, 6);

  return {
    source: catalog.source,
    appliedFilters: filters,
    ranking: RANKING_METADATA,
    results,
  };
}
