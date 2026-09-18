"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Intent } from "@/types/intent";
import type { SearchResult, SearchResponse } from "@/types/search";

type IntentApiResponse =
  | { ok: true; intent: Intent }
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  }).format(new Date(value));
}

function ResultCard({ result, rank }: { result: SearchResult; rank: number }) {
  return (
    <article className="resultCard">
      <div className="resultTopline">
        <span className="rank">#{rank}</span>
        <span className="score">{result.matchScore}% match</span>
      </div>
      <h2>{result.businessName}</h2>
      <p className="serviceName">{result.serviceName}</p>
      <div className="resultMeta">
        <span>★ {result.rating ?? "New"}</span>
        <span>📍 {result.address}</span>
        <span>🕒 {formatTime(result.availableTime)}</span>
      </div>
      <div className="why">
        {result.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <div className="resultFooter">
        <strong>{result.price} {result.currency}</strong>
        <button type="button" disabled title="Booking is coming in a later milestone">
          Book · soon
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const [request, setRequest] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [source, setSource] = useState<SearchResponse["source"] | null>(null);
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
    setLoading(true);
    setError(null);
    setIntent(null);
    setResults([]);
    setSource(null);

    try {
      const intentResponse = await fetch("/api/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const intentData = (await intentResponse.json()) as IntentApiResponse;
      if (!intentData.ok) throw new Error(intentData.error || "Intent request failed");
      setIntent(intentData.intent);

      const searchResponse = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intentData.intent),
      });
      const searchData = (await searchResponse.json()) as SearchApiResponse;
      if (!searchData.ok) throw new Error(searchData.error || "Search failed");
      setResults(searchData.results);
      setSource(searchData.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brandRow">
          <div className="brand">AYLO <span>alpha</span></div>
          <div className="topActions">
            <Link href="/businesses" className="manageLink">Manage businesses →</Link>
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

        <form className="intentBox" onSubmit={submit}>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Sabah 18:00-da Ağ Şəhərdə 120 AZN-dən ucuz saç və makiyaj…"
            rows={4}
          />
          <div className="actions">
            <span>V1 · Beauty services</span>
            <button disabled={loading || request.trim().length < 3}>
              {loading ? "Searching…" : "Find it →"}
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
          <div className="resultsHeader">
            <div>
              <p className="eyebrow">Best matches</p>
              <h2>{results.length} providers found</h2>
            </div>
            <span className={`sourceBadge ${source}`}>
              {source === "supabase" ? "Live database" : "Demo data"}
            </span>
          </div>
        )}

        {source && results.length === 0 && (
          <div className="panel">No matching provider found. Try another time or budget.</div>
        )}

        <div className="resultsGrid">
          {results.map((result, index) => (
            <ResultCard key={result.id} result={result} rank={index + 1} />
          ))}
        </div>
      </section>
    </main>
  );
}
