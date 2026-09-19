import type { Intent } from "@/types/intent";
import type { ProviderCandidate } from "@/types/provider";
import type { SearchResult } from "@/types/search";
import {
  buildReasons,
  compareSearchResults,
  locationMatches,
  matchScore,
  requestedDate,
  resultMatchesFilters,
  serviceCoverage,
  timeDistanceMinutes,
} from "./shared";

export function searchDemoProviders(
  intent: Intent,
  providers: ProviderCandidate[],
): SearchResult[] {
  const date = requestedDate(intent);
  const [baseHour, baseMinute] = (intent.time_from ?? "18:00").split(":").map(Number);

  return providers
    .map((provider, index) => {
      const {
        businessId,
        businessName,
        serviceId,
        serviceName,
        address,
        price,
        currency,
        durationMinutes,
        rating,
        verified,
      } = provider;
      const coverage = serviceCoverage(serviceName, intent.services);
      const totalMinutes = baseHour * 60 + baseMinute + (index % 3) * 30;
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      const availableTime = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+04:00`;
      const timeDistance = timeDistanceMinutes(availableTime, intent);
      const locationMatch = locationMatches(address, intent.location);
      const score = matchScore({
        coverage,
        price,
        budgetMax: intent.budget_max,
        timeDistance,
        rating,
        locationMatch,
      });

      return {
        id: `demo-${index + 1}`,
        businessId,
        businessName,
        serviceId,
        serviceName,
        address,
        price,
        currency,
        durationMinutes,
        rating,
        verified,
        availableTime,
        matchScore: score,
        reasons: buildReasons({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          verified,
        }),
      } satisfies SearchResult;
    })
    .filter((result) => resultMatchesFilters(result, intent))
    .sort(compareSearchResults)
    .slice(0, 6);
}
