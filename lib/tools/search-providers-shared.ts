import type { ProviderCandidate } from "@/types/provider";
import type { SearchProvidersToolInput } from "./search-providers-contract";
import { serviceCoverage, serviceMatchesFilters } from "../search/shared";

export function filterProviderCandidates(
  candidates: ProviderCandidate[],
  input: SearchProvidersToolInput,
) {
  return candidates
    .filter((candidate) => serviceMatchesFilters(candidate, input))
    .sort(
      (a, b) =>
        serviceCoverage(b.serviceName, input.services) -
          serviceCoverage(a.serviceName, input.services) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        a.price - b.price ||
        a.businessName.localeCompare(b.businessName, "az") ||
        a.serviceId.localeCompare(b.serviceId),
    )
    .slice(0, input.limit);
}
