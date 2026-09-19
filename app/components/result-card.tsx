import type { CSSProperties } from "react";
import type { RankingWeights, SearchResult } from "@/types/search";
import {
  formatDuration,
  matchLabel,
  providerInitials,
  scoreFactors,
} from "@/lib/search/presentation";

type ResultCardProps = {
  result: SearchResult;
  rank: number;
  weights: RankingWeights;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  }).format(new Date(value));
}

export function ResultCard({ result, rank, weights }: ResultCardProps) {
  const factors = scoreFactors(result.scoreBreakdown, weights);
  const headingId = `result-${result.id}-heading`;
  const scoreStyle = {
    "--score-width": `${Math.min(100, Math.max(0, result.matchScore))}%`,
  } as CSSProperties;

  return (
    <article
      className={`resultCard${rank === 1 ? " featured" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="resultCardHeader">
        <div className="resultBadges">
          <span className={rank === 1 ? "bestMatchBadge" : "rankBadge"}>
            {rank === 1 ? "Best match" : `#${rank}`}
          </span>
          {result.verified && <span className="resultVerifiedBadge">✓ Verified</span>}
        </div>
        <div className="matchScoreBlock">
          <div>
            <strong>{result.matchScore}</strong>
            <span>% match</span>
          </div>
          <small>{matchLabel(result.matchScore)}</small>
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
          <strong>{formatTime(result.availableTime)}</strong>
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
        <span>Booking flow coming soon</span>
        <button type="button" disabled title="Booking is coming in a later milestone">
          Book appointment
        </button>
      </div>
    </article>
  );
}
