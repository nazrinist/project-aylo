"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { FollowUpQuestion } from "@/types/follow-up";
import type { Intent } from "@/types/intent";
import type { RequestPersistence } from "@/types/request";
import type {
  RankingMetadata,
  SearchResult,
  SearchResponse,
} from "@/types/search";
import {
  MAX_COMPARISON_OFFERS,
  selectedComparisonResults,
  toggleComparisonSelection,
} from "@/lib/search/comparison";
import { OfferComparison } from "@/app/components/offer-comparison";
import { ResultCard } from "@/app/components/result-card";

type IntentApiResponse =
  | { ok: true; intent: Intent; followUp: FollowUpQuestion | null }
  | { ok: false; error: string };

type SearchApiResponse =
  | ({ ok: true } & SearchResponse)
  | { ok: false; error: string };

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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [source, setSource] = useState<SearchResponse["source"] | null>(null);
  const [ranking, setRanking] = useState<RankingMetadata | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [requestPersistence, setRequestPersistence] = useState<RequestPersistence | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
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
    setError(null);
  }

  const comparedResults = selectedComparisonResults(results, comparisonIds);

  function toggleComparison(resultId: string) {
    setComparisonIds((current) => toggleComparisonSelection(current, resultId));
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brandRow">
          <div className="brand">AYLO <span>alpha</span></div>
          <div className="topActions">
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
              onCompareToggle={() => toggleComparison(result.id)}
            />
          ))}
        </div>

        {ranking && (
          <OfferComparison
            results={comparedResults}
            weights={ranking.weights}
            onRemove={toggleComparison}
            onClear={() => setComparisonIds([])}
          />
        )}
      </section>
    </main>
  );
}
