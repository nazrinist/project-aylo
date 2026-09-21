"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { FollowUpQuestion } from "@/types/follow-up";
import type { Intent } from "@/types/intent";
import type { RequestPersistence } from "@/types/request";
import type {
  BookingConfirmation as ConfirmedBooking,
  BookingSubmissionResult,
  PersistedBooking,
} from "@/types/booking";
import type {
  BookableSearchResult,
  RankingMetadata,
  SearchResponse,
} from "@/types/search";
import { bookingInputFromConfirmation } from "@/lib/bookings/shared";
import {
  MAX_COMPARISON_OFFERS,
  selectedComparisonResults,
  toggleComparisonSelection,
} from "@/lib/search/comparison";
import { OfferComparison } from "@/app/components/offer-comparison";
import { BookingConfirmation } from "@/app/components/booking-confirmation";
import { ResultCard } from "@/app/components/result-card";

type IntentApiResponse =
  | { ok: true; intent: Intent; followUp: FollowUpQuestion | null }
  | { ok: false; error: string };

type SearchApiResponse =
  | ({ ok: true } & SearchResponse)
  | { ok: false; error: string };

type BookingApiResponse =
  | { ok: true; booking: PersistedBooking; created: boolean }
  | { ok: false; code: string; error: string };

type DatabaseHealth = {
  status: "checking" | "demo" | "live" | "error";
  database?: string;
  message?: string;
  counts: null | {
    businesses: number;
    services: number;
    availableSlots: number;
  };
};

export default function Home() {
  const [request, setRequest] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [followUp, setFollowUp] = useState<FollowUpQuestion | null>(null);
  const [conversationRequest, setConversationRequest] = useState("");
  const [results, setResults] = useState<BookableSearchResult[]>([]);
  const [source, setSource] = useState<SearchResponse["source"] | null>(null);
  const [ranking, setRanking] = useState<RankingMetadata | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [requestPersistence, setRequestPersistence] = useState<RequestPersistence | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [bookingOffer, setBookingOffer] = useState<BookableSearchResult | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [persistedBooking, setPersistedBooking] = useState<PersistedBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<DatabaseHealth>({
    status: "checking",
    counts: null,
  });

  useEffect(() => {
    let active = true;

    fetch("/api/health", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as DatabaseHealth;
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) {
          setHealth({ status: "error", database: "unreachable", counts: null });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request.trim()) return;
    const answer = request.trim();
    const fullRequest = followUp && conversationRequest
      ? `${conversationRequest}\n${followUp.field}: ${answer}`
      : answer;
    setLoading(true);
    setError(null);
    setResults([]);
    setSource(null);
    setRanking(null);
    setAppliedFilters([]);
    setRequestPersistence(null);
    setComparisonIds([]);
    setBookingOffer(null);
    setConfirmedBooking(null);
    setPersistedBooking(null);
    setFollowUp(null);

    try {
      const intentResponse = await fetch("/api/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: fullRequest }),
      });
      const intentData = (await intentResponse.json()) as IntentApiResponse;
      if (!intentData.ok) throw new Error(intentData.error || "Intent request failed");
      setIntent(intentData.intent);

      if (intentData.followUp) {
        setFollowUp(intentData.followUp);
        setConversationRequest(fullRequest);
        setRequest("");
        return;
      }

      const searchResponse = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intentData.intent),
      });
      const searchData = (await searchResponse.json()) as SearchApiResponse;
      if (!searchData.ok) throw new Error(searchData.error || "Search failed");
      setResults(searchData.results);
      setSource(searchData.source);
      setRanking(searchData.ranking);
      setAppliedFilters(searchData.appliedFilters);
      setRequestPersistence(searchData.requestPersistence);
      setConversationRequest("");
      setRequest("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setRequest("");
    setConversationRequest("");
    setIntent(null);
    setFollowUp(null);
    setResults([]);
    setSource(null);
    setRanking(null);
    setAppliedFilters([]);
    setRequestPersistence(null);
    setComparisonIds([]);
    setBookingOffer(null);
    setConfirmedBooking(null);
    setPersistedBooking(null);
    setError(null);
  }

  const comparedResults = selectedComparisonResults(results, comparisonIds);
  const confirmedOffer = confirmedBooking
    ? results.find((result) => result.id === confirmedBooking.availabilityId) ?? null
    : null;

  function toggleComparison(resultId: string) {
    setComparisonIds((current) => toggleComparisonSelection(current, resultId));
  }

  function openBooking(resultId: string) {
    const result = results.find((candidate) => candidate.id === resultId);
    if (result) setBookingOffer(result);
  }

  async function saveConfirmedBooking(
    confirmation: ConfirmedBooking,
  ): Promise<BookingSubmissionResult> {
    const input = bookingInputFromConfirmation(confirmation);
    if (!input) {
      setConfirmedBooking(confirmation);
      setPersistedBooking(null);
      return { status: "local", booking: null };
    }

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as BookingApiResponse;
    if (!response.ok || !data.ok) {
      throw new Error(data.ok ? "The booking could not be created" : data.error);
    }

    setConfirmedBooking(confirmation);
    setPersistedBooking(data.booking);
    return { status: "saved", booking: data.booking };
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brandRow">
          <div className="brand">AYLO <span>alpha</span></div>
          <div className="topActions">
            <Link href="/dashboard" className="manageLink">Dashboard →</Link>
            <Link href="/leads" className="manageLink">Lead inbox →</Link>
            <Link href="/analytics" className="manageLink">Analytics →</Link>
            <Link href="/businesses" className="manageLink">Manage businesses →</Link>
            <Link href="/availability" className="manageLink">Availability →</Link>
            <div className={`databaseStatus ${health.status}`}>
              <i aria-hidden="true" />
              {health.status === "checking" && "Checking database…"}
              {health.status === "demo" && "Demo database"}
              {health.status === "live" && "Supabase connected"}
              {health.status === "error" && "Supabase setup needed"}
            </div>
          </div>
        </div>
        <h1>What do you need?</h1>
        <p className="subtitle">Tell Aylo. We turn your intent into action.</p>

        {health.status === "live" && health.counts && (
          <div className="databaseCounts">
            <span><strong>{health.counts.businesses}</strong> businesses</span>
            <span><strong>{health.counts.services}</strong> services</span>
            <span><strong>{health.counts.availableSlots}</strong> open slots</span>
          </div>
        )}

        {health.status === "error" && (
          <div className="setupNotice">
            Supabase is reachable, but its tables or keys are not ready. Follow
            <code> docs/DAY_3.md</code> and restart the dev server.
          </div>
        )}

        {followUp && (
          <section className="followUpPanel" aria-live="polite">
            <div className="followUpHeading">
              <div>
                <p className="eyebrow">One more detail</p>
                <h2>{followUp.question}</h2>
              </div>
              <button type="button" className="textButton" onClick={resetFlow}>Start over</button>
            </div>
            <div className="followUpExamples">
              {followUp.examples.map((example) => (
                <button type="button" key={example} onClick={() => setRequest(example)}>
                  {example}
                </button>
              ))}
            </div>
          </section>
        )}

        <form className="intentBox" onSubmit={submit}>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={followUp?.question ?? "Sabah 18:00-da Ağ Şəhərdə 120 AZN-dən ucuz saç və makiyaj…"}
            rows={4}
          />
          <div className="actions">
            <span>{followUp ? `Missing · ${followUp.field}` : "V1 · Beauty services"}</span>
            <button disabled={loading || request.trim().length < 3}>
              {loading ? "Working…" : followUp ? "Continue →" : "Find it →"}
            </button>
          </div>
        </form>

        {error && <div className="panel error">{error}</div>}

        {intent && (
          <details className="panel intentPanel">
            <summary>Aylo understood your request</summary>
            <pre>{JSON.stringify(intent, null, 2)}</pre>
          </details>
        )}

        {source && (
          <>
            <div className="resultsHeader">
              <div>
                <p className="eyebrow">Applied filters</p>
                <h2>{results.length} providers found</h2>
              </div>
              <div className="resultsBadges">
                {ranking && (
                  <span className="rankingBadge">Explainable ranking · {ranking.version}</span>
                )}
                <span className={`sourceBadge ${source}`}>
                  {source === "supabase" ? "Live database" : "Demo data"}
                </span>
              </div>
            </div>
            <div className="filterChips" aria-label="Applied search filters">
              {appliedFilters.map((filter) => <span key={filter}>{filter}</span>)}
            </div>
            {requestPersistence && (
              <div className={`persistenceStatus ${requestPersistence.status}`}>
                {requestPersistence.status === "saved" && "Request saved privately"}
                {requestPersistence.status === "disabled" && "Request history is off in demo mode"}
                {requestPersistence.status === "failed" && "Search worked, but the request was not saved"}
              </div>
            )}
            {confirmedBooking && confirmedOffer && (
              <section
                className={`bookingDraftStatus ${persistedBooking ? "saved" : "local"}`}
                aria-live="polite"
              >
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>
                    {persistedBooking ? "Booking request created" : "Booking details confirmed locally"}
                  </strong>
                  <small>
                    {confirmedOffer.businessName} · {persistedBooking
                      ? "Pending provider confirmation"
                      : "Not saved"}
                  </small>
                </div>
                <button type="button" onClick={() => setBookingOffer(confirmedOffer)}>
                  Review
                </button>
              </section>
            )}
          </>
        )}

        {source && results.length === 0 && (
          <div className="panel">No matching provider found. Try another time or budget.</div>
        )}

        {results.length > 1 && (
          <div className="compareIntro">
            <span>Compare mode</span>
            Choose up to {MAX_COMPARISON_OFFERS} offers to inspect side by side.
          </div>
        )}

        <div className="resultsGrid">
          {ranking && results.map((result, index) => (
            <ResultCard
              key={result.id}
              result={result}
              rank={index + 1}
              weights={ranking.weights}
              selectedForCompare={comparisonIds.includes(result.id)}
              compareDisabled={
                comparisonIds.length >= MAX_COMPARISON_OFFERS
                && !comparisonIds.includes(result.id)
              }
              bookingState={
                persistedBooking?.availabilityId === result.id
                  ? "saved"
                  : confirmedBooking?.availabilityId === result.id
                    ? "local"
                    : "idle"
              }
              bookingDisabled={Boolean(
                persistedBooking && persistedBooking.availabilityId !== result.id,
              )}
              onCompareToggle={() => toggleComparison(result.id)}
              onBook={() => setBookingOffer(result)}
            />
          ))}
        </div>

        {ranking && (
          <OfferComparison
            results={comparedResults}
            weights={ranking.weights}
            confirmedOfferId={confirmedBooking?.availabilityId ?? null}
            lockedOfferId={persistedBooking?.availabilityId ?? null}
            onRemove={toggleComparison}
            onClear={() => setComparisonIds([])}
            onBook={openBooking}
          />
        )}
      </section>

      {bookingOffer && (
        <BookingConfirmation
          offer={bookingOffer}
          requestId={requestPersistence?.requestId ?? null}
          confirmedBooking={confirmedBooking}
          persistedBooking={persistedBooking}
          onConfirm={saveConfirmedBooking}
          onClose={() => setBookingOffer(null)}
        />
      )}
    </main>
  );
}
