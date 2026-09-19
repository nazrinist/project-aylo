import type { SearchResult } from "@/types/search";

export const MAX_COMPARISON_OFFERS = 3;

export type ComparisonHighlights = {
  bestScoreIds: string[];
  lowestPriceIds: string[];
  bestTimeFitIds: string[];
  topRatingIds: string[];
};

export function toggleComparisonSelection(
  selectedIds: string[],
  resultId: string,
  maximum = MAX_COMPARISON_OFFERS,
) {
  if (selectedIds.includes(resultId)) {
    return selectedIds.filter((id) => id !== resultId);
  }

  if (selectedIds.length >= maximum) return selectedIds;
  return [...selectedIds, resultId];
}

export function selectedComparisonResults(
  results: SearchResult[],
  selectedIds: string[],
) {
  const selected = new Set(selectedIds);
  return results.filter((result) => selected.has(result.id));
}

function extremeIds(
  results: SearchResult[],
  valueFor: (result: SearchResult) => number | null,
  direction: "highest" | "lowest",
) {
  const values = results.flatMap((result) => {
    const value = valueFor(result);
    return value === null || !Number.isFinite(value)
      ? []
      : [{ id: result.id, value }];
  });

  if (values.length === 0) return [];

  const extreme = direction === "highest"
    ? Math.max(...values.map(({ value }) => value))
    : Math.min(...values.map(({ value }) => value));

  return values
    .filter(({ value }) => value === extreme)
    .map(({ id }) => id);
}

export function comparisonHighlights(
  results: SearchResult[],
): ComparisonHighlights {
  return {
    bestScoreIds: extremeIds(results, (result) => result.matchScore, "highest"),
    lowestPriceIds: extremeIds(results, (result) => result.price, "lowest"),
    bestTimeFitIds: extremeIds(
      results,
      (result) => result.scoreBreakdown.time,
      "highest",
    ),
    topRatingIds: extremeIds(results, (result) => result.rating, "highest"),
  };
}
