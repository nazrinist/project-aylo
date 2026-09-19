import type { ReactNode } from "react";
import type { RankingWeights, SearchResult } from "@/types/search";
import { comparisonHighlights } from "@/lib/search/comparison";
import {
  formatBakuDateTime,
  formatDuration,
  scoreFactors,
} from "@/lib/search/presentation";

type OfferComparisonProps = {
  results: SearchResult[];
  weights: RankingWeights;
  confirmedOfferId: string | null;
  onRemove: (resultId: string) => void;
  onClear: () => void;
  onBook: (result: SearchResult) => void;
};

type ComparisonRowProps = {
  label: string;
  results: SearchResult[];
  valueFor: (result: SearchResult) => ReactNode;
  highlightedIds?: string[];
  highlightLabel?: string;
};

function ComparisonRow({
  label,
  results,
  valueFor,
  highlightedIds = [],
  highlightLabel,
}: ComparisonRowProps) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {results.map((result) => {
        const highlighted = highlightedIds.includes(result.id);
        return (
          <td className={highlighted ? "comparisonBest" : undefined} key={result.id}>
            <strong>{valueFor(result)}</strong>
            {highlighted && highlightLabel && (
              <span className="comparisonWinner">{highlightLabel}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function OfferComparison({
  results,
  weights,
  confirmedOfferId,
  onRemove,
  onClear,
  onBook,
}: OfferComparisonProps) {
  if (results.length === 0) return null;

  const highlights = comparisonHighlights(results);
  const factorsByResult = new Map(
    results.map((result) => [
      result.id,
      scoreFactors(result.scoreBreakdown, weights),
    ]),
  );
  const factorRows = factorsByResult.get(results[0].id) ?? [];

  return (
    <section className="comparisonPanel" aria-labelledby="comparison-heading">
      <div className="comparisonHeader">
        <div>
          <p className="eyebrow">Side-by-side</p>
          <h2 id="comparison-heading">Compare offers</h2>
          <p>{results.length} / 3 selected</p>
        </div>
        <button type="button" className="comparisonClear" onClick={onClear}>
          Clear all
        </button>
      </div>

      <div className="comparisonSelection" aria-label="Selected offers">
        {results.map((result) => (
          <span key={result.id}>
            {result.businessName}
            <button
              type="button"
              onClick={() => onRemove(result.id)}
              aria-label={`Remove ${result.businessName} from comparison`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {results.length < 2 ? (
        <p className="comparisonPrompt" aria-live="polite">
          Select one more offer to open the side-by-side comparison.
        </p>
      ) : (
        <div
          className="comparisonTableWrap"
          tabIndex={0}
          aria-label="Scrollable offer comparison"
        >
          <table className="comparisonTable">
            <caption className="srOnly">
              Selected offers compared by price, availability, provider details,
              and ranking factors
            </caption>
            <thead>
              <tr>
                <th scope="col">Criteria</th>
                {results.map((result) => (
                  <th scope="col" key={result.id}>
                    <span>Provider</span>
                    <strong>{result.businessName}</strong>
                    <div className="comparisonColumnActions">
                      <button
                        type="button"
                        className="comparisonBook"
                        onClick={() => onBook(result)}
                      >
                        {confirmedOfferId === result.id ? "Review booking" : "Book offer"}
                      </button>
                      <button
                        type="button"
                        className="comparisonRemove"
                        onClick={() => onRemove(result.id)}
                        aria-label={`Remove ${result.businessName} from comparison`}
                      >
                        Remove
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                label="Match score"
                results={results}
                valueFor={(result) => `${result.matchScore}%`}
                highlightedIds={highlights.bestScoreIds}
                highlightLabel="Best score"
              />
              <ComparisonRow
                label="Price"
                results={results}
                valueFor={(result) => `${result.price} ${result.currency}`}
                highlightedIds={highlights.lowestPriceIds}
                highlightLabel="Lowest"
              />
              <ComparisonRow
                label="Available"
                results={results}
                valueFor={(result) => formatBakuDateTime(result.availableTime)}
              />
              <ComparisonRow
                label="Duration"
                results={results}
                valueFor={(result) => formatDuration(result.durationMinutes)}
              />
              <ComparisonRow
                label="Rating"
                results={results}
                valueFor={(result) => result.rating ?? "New provider"}
                highlightedIds={highlights.topRatingIds}
                highlightLabel="Top rated"
              />
              <ComparisonRow
                label="Verified"
                results={results}
                valueFor={(result) => result.verified ? "Yes" : "No"}
              />
              <ComparisonRow
                label="Service"
                results={results}
                valueFor={(result) => result.serviceName}
              />
              <ComparisonRow
                label="Location"
                results={results}
                valueFor={(result) => result.address}
              />
              <tr className="comparisonSectionRow">
                <th colSpan={results.length + 1} scope="rowgroup">
                  Ranking factors
                </th>
              </tr>
              {factorRows.map((factor, factorIndex) => (
                <ComparisonRow
                  key={factor.key}
                  label={factor.label}
                  results={results}
                  valueFor={(result) => {
                    const value = factorsByResult.get(result.id)?.[factorIndex];
                    return value ? `${value.score} / ${value.maximum}` : "—";
                  }}
                  highlightedIds={factor.key === "time" ? highlights.bestTimeFitIds : []}
                  highlightLabel={factor.key === "time" ? "Best time fit" : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
