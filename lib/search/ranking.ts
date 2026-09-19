import type { Intent } from "@/types/intent";
import type {
  RankableSearchResult,
  RankingMetadata,
  RankingScoreBreakdown,
  SearchResult,
} from "@/types/search";
import {
  locationMatches,
  serviceCoverage,
  timeDistanceMinutes,
} from "./shared";

export const RANKING_WEIGHTS = {
  service: 35,
  time: 25,
  budget: 15,
  rating: 15,
  location: 5,
  verified: 5,
} as const;

export const RANKING_METADATA: RankingMetadata = {
  version: "v1",
  weights: RANKING_WEIGHTS,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function budgetScore(
  price: number,
  budgetMin: number | null,
  budgetMax: number | null,
) {
  if (budgetMin !== null && price < budgetMin) return 0;
  if (budgetMax === null) return RANKING_WEIGHTS.budget;
  if (price > budgetMax) return 0;
  if (budgetMax === 0) {
    return price === 0 ? RANKING_WEIGHTS.budget : 0;
  }

  const floor = budgetMin ?? 0;
  const range = budgetMax - floor;
  if (range <= 0) return RANKING_WEIGHTS.budget;
  const position = clamp((price - floor) / range, 0, 1);
  return RANKING_WEIGHTS.budget - position * 5;
}

function buildReasons(input: {
  intent: Intent;
  coverage: number;
  timeDistance: number;
  price: number;
  rating: number | null;
  locationMatch: boolean;
  verified: boolean;
}) {
  const reasons: string[] = [];
  if (input.coverage === 1) reasons.push("All requested services match");

  if (input.intent.time_from) {
    if (input.timeDistance === 0) reasons.push("Exact preferred time");
    else if (input.timeDistance <= 30) reasons.push("Close to your preferred time");
    else if (input.timeDistance <= 60) reasons.push("Within your time window");
  }

  if (
    input.intent.budget_max !== null &&
    input.price <= input.intent.budget_max
  ) {
    reasons.push("Within budget");
  }
  if ((input.rating ?? 0) >= 4.8) reasons.push("Highly rated");
  if (input.verified) reasons.push("Verified provider");
  if (input.locationMatch) reasons.push("Requested area");
  return reasons.slice(0, 3);
}

export function scoreSearchResult(
  candidate: RankableSearchResult,
  intent: Intent,
): SearchResult {
  const coverage = serviceCoverage(candidate.serviceName, intent.services);
  const locationMatch = locationMatches(candidate.address, intent.location);
  const timeDistance = timeDistanceMinutes(candidate.availableTime, intent);
  const rating = clamp(candidate.rating ?? 4, 0, 5);

  const factors = {
    service: roundOne(clamp(coverage, 0, 1) * RANKING_WEIGHTS.service),
    time: roundOne(
      intent.time_from
        ? Math.max(0, 1 - timeDistance / 120) * RANKING_WEIGHTS.time
        : RANKING_WEIGHTS.time,
    ),
    budget: roundOne(
      budgetScore(candidate.price, intent.budget_min, intent.budget_max),
    ),
    rating: roundOne((rating / 5) * RANKING_WEIGHTS.rating),
    location: locationMatch ? RANKING_WEIGHTS.location : 0,
    verified: candidate.verified ? RANKING_WEIGHTS.verified : 0,
  };
  const total = roundOne(
    Object.values(factors).reduce((sum, value) => sum + value, 0),
  );
  const scoreBreakdown: RankingScoreBreakdown = { ...factors, total };

  return {
    ...candidate,
    matchScore: total,
    scoreBreakdown,
    reasons: buildReasons({
      intent,
      coverage,
      timeDistance,
      price: candidate.price,
      rating: candidate.rating,
      locationMatch,
      verified: candidate.verified,
    }),
  };
}

export function compareRankedResults(a: SearchResult, b: SearchResult) {
  return (
    b.matchScore - a.matchScore ||
    a.price - b.price ||
    a.availableTime.localeCompare(b.availableTime) ||
    a.businessName.localeCompare(b.businessName, "az") ||
    a.id.localeCompare(b.id)
  );
}

export function rankSearchResults(
  candidates: RankableSearchResult[],
  intent: Intent,
  limit = 6,
) {
  return candidates
    .map((candidate) => scoreSearchResult(candidate, intent))
    .sort(compareRankedResults)
    .slice(0, limit);
}
