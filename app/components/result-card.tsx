import type { CSSProperties } from "react";
import type { RankingWeights, SearchResult } from "@/types/search";
import {
  formatBakuDateTime,
  formatDuration,
  matchLabel,
  providerInitials,
  scoreFactors,
} from "@/lib/search/presentation";

type ResultCardProps = {
  result: SearchResult;
  rank: number;
  weights: RankingWeights;
  selectedForCompare: boolean;
  compareDisabled: boolean;
  bookingState: "idle" | "local" | "saved";
  bookingDisabled: boolean;
  onCompareToggle: () => void;
  onBook: () => void;
};

export function ResultCard({
  result,
  rank,
  weights,
  selectedForCompare,
  compareDisabled,
  bookingState,
  bookingDisabled,
  onCompareToggle,
  onBook,
}: ResultCardProps) {
  const factors = scoreFactors(result.scoreBreakdown, weights);
  const headingId = `result-${result.id}-heading`;
  const scoreStyle = {
    "--score-width": `${Math.min(100, Math.max(0, result.matchScore))}%`,
  } as CSSProperties;

  return (
    <article
      className={`resultCard${rank === 1 ? " featured" : ""}${selectedForCompare ? " compared" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="resultCardHeader">
        <div className="resultBadges">
          <span className={rank === 1 ? "bestMatchBadge" : "rankBadge"}>
            {rank === 1 ? "Best match" : `#${rank}`}
          </span>
          {result.verified && <span className="resultVerifiedBadge">✓ Verified</span>}
        </div>
        <div className="resultHeaderActions">
          <button
            type="button"
            className={`compareToggle${selectedForCompare ? " selected" : ""}`}
            aria-pressed={selectedForCompare}
            disabled={compareDisabled}
            onClick={onCompareToggle}
            title={compareDisabled ? "You can compare up to 3 offers" : undefined}
          >
            {selectedForCompare ? "✓ Added" : "+ Compare"}
          </button>
          <div className="matchScoreBlock">
            <div>
              <strong>{result.matchScore}</strong>
              <span>% match</span>
            </div>
            <small>{matchLabel(result.matchScore)}</small>
          </div>
        </div>
      </div>

      <div
        className="matchTrack"
        role="progressbar"
        aria-label={`${result.businessName} match score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.matchScore}
        style={scoreStyle}
      >
        <span />
      </div>

      <div className="providerIdentity">
        <div className="providerAvatar" aria-hidden="true">
          {providerInitials(result.businessName)}
        </div>
        <div>
          <h2 id={headingId}>{result.businessName}</h2>
          <p>{result.serviceName}</p>
        </div>
      </div>

      <div className="offerFacts">
        <div>
          <span>Price</span>
          <strong>{result.price} {result.currency}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{formatBakuDateTime(result.availableTime)}</strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{formatDuration(result.durationMinutes)}</strong>
        </div>
      </div>

      <div className="providerMeta">
        <span><b aria-hidden="true">★</b> {result.rating ?? "New provider"}</span>
        <span><b aria-hidden="true">⌖</b> {result.address}</span>
      </div>

      <div className="why" aria-label="Top match reasons">
        {result.reasons.map((reason) => (
          <span key={reason}>✓ {reason}</span>
        ))}
      </div>

      <details className="scoreDetails">
        <summary>
          <span>Why this match?</span>
          <small>See score details</small>
        </summary>
        <div className="factorList">
          {factors.map((factor) => (
            <div className="factorRow" key={factor.key}>
              <div className="factorHeading">
                <span>{factor.label}</span>
                <strong>{factor.score} / {factor.maximum}</strong>
              </div>
              <div
                className="factorTrack"
                role="progressbar"
                aria-label={`${factor.label} score`}
                aria-valuemin={0}
                aria-valuemax={factor.maximum}
                aria-valuenow={factor.score}
              >
                <span style={{ width: `${factor.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="resultFooter">
        <span className={bookingState !== "idle" ? "bookingConfirmedLabel" : undefined}>
          {bookingState === "saved"
            ? "✓ Slot booked · provider pending"
            : bookingState === "local"
              ? "✓ Details confirmed · not saved"
              : bookingDisabled
                ? "Another offer is already booked"
                : "Review before confirming"}
        </span>
        <button
          type="button"
          className={bookingState !== "idle" ? "bookingReviewButton" : undefined}
          onClick={onBook}
          disabled={bookingDisabled}
          title={bookingDisabled ? "This request already has a booking" : undefined}
        >
          {bookingState !== "idle"
            ? "Review booking"
            : bookingDisabled
              ? "Booking created"
              : "Book appointment"}
        </button>
      </div>
    </article>
  );
}
