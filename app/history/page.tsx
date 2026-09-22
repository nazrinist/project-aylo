"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  RequestHistoryApiResponse,
  RequestHistoryData,
  RequestHistoryEntry,
  RequestHistoryStatus,
} from "@/types/history";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function statusLabel(status: RequestHistoryStatus) {
  const labels: Record<RequestHistoryStatus, string> = {
    new: "New",
    searched: "Searched",
    failed: "Failed",
    completed: "Completed",
    cancelled: "Cancelled",
    unknown: "Unknown",
  };
  return labels[status];
}

function createdLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
}

function budgetLabel(entry: RequestHistoryEntry) {
  if (entry.budgetMin !== null && entry.budgetMax !== null) {
    return `${entry.budgetMin}–${entry.budgetMax} ${entry.currency}`;
  }
  if (entry.budgetMax !== null) return `Up to ${entry.budgetMax} ${entry.currency}`;
  if (entry.budgetMin !== null) return `From ${entry.budgetMin} ${entry.currency}`;
  return "Any budget";
}

function scheduleLabel(entry: RequestHistoryEntry) {
  const time = entry.timeFrom && entry.timeTo
    ? `${entry.timeFrom}–${entry.timeTo}`
    : entry.timeFrom ?? entry.timeTo;
  if (entry.requestedDate && time) return `${entry.requestedDate} · ${time}`;
  return entry.requestedDate ?? time ?? "Flexible time";
}

export default function RequestHistoryPage() {
  const [data, setData] = useState<RequestHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const result = (await response.json()) as RequestHistoryApiResponse;
      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("Request history could not be loaded.");
      const { ok: _ok, ...history } = result;
      setData(history);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function forgetHistory() {
    if (!window.confirm("Forget this history on this browser? Private database records are not deleted.")) return;
    setClearing(true);
    setError(null);
    try {
      const response = await fetch("/api/history", { method: "DELETE" });
      if (!response.ok) throw new Error("Request history could not be forgotten.");
      setData((current) => current ? { ...current, entries: [] } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request history could not be forgotten.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="businessShell historyShell">
      <header className="businessHeader historyHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
          </div>
          <p className="eyebrow">Aylo · Day 22</p>
          <h1>Request history</h1>
          <p>Your recent saved searches from this browser.</p>
        </div>
        {data?.historyAvailable && (
          <span className="historyHeaderBadge">{data.entries.length} of {data.limit}</span>
        )}
      </header>

      {loading && !data && (
        <section className="historyLoading" aria-live="polite">Loading private request history…</section>
      )}

      {error && (
        <section className="historyError" role="alert">
          <div><strong>History is unavailable</strong><p>{error}</p></div>
          <button type="button" onClick={() => void loadHistory()} disabled={loading}>Try again</button>
        </section>
      )}

      {data && !data.historyAvailable && (
        <section className="historyUnavailable">
          <span aria-hidden="true">◇</span>
          <div>
            <p className="eyebrow">Private persistence is off</p>
            <h2>History stays hidden in {data.source} mode.</h2>
            <p>
              Request history needs the server-side Supabase secret key. Searches
              still work here, but demo and public catalog modes do not read the
              private <code>requests</code> table.
            </p>
          </div>
        </section>
      )}

      {data?.historyAvailable && (
        <>
          <section className="historyToolbar">
            <div>
              <p className="eyebrow">This browser only</p>
              <strong>{data.entries.length} saved request{data.entries.length === 1 ? "" : "s"}</strong>
            </div>
            <div>
              <button type="button" className="historySecondaryAction" onClick={() => void loadHistory()} disabled={loading || clearing}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button type="button" className="historyForgetAction" onClick={() => void forgetHistory()} disabled={data.entries.length === 0 || loading || clearing}>
                {clearing ? "Forgetting…" : "Forget this browser"}
              </button>
            </div>
          </section>

          {data.entries.length === 0 ? (
            <section className="historyEmptyState">
              <span aria-hidden="true">+</span>
              <h2>No saved requests on this browser yet</h2>
              <p>Your next successful live search will appear here.</p>
              <Link href="/">Start a request →</Link>
            </section>
          ) : (
            <ol className="historyList">
              {data.entries.map((entry) => (
                <li key={`${entry.reference}:${entry.createdAt}`}>
                  <article className="historyCard">
                    <header>
                      <span className={`historyStatus ${entry.status}`}>{statusLabel(entry.status)}</span>
                      <span className="historyReference">Request {entry.reference}</span>
                    </header>
                    <div className="historyCardBody">
                      <div className="historyCardTitle">
                        <div>
                          <p className="eyebrow">Original request</p>
                          <h2>{entry.originalRequest}</h2>
                        </div>
                        <time dateTime={entry.createdAt}>{createdLabel(entry.createdAt)}</time>
                      </div>
                      {entry.services.length > 0 && (
                        <div className="historyServices" aria-label="Requested services">
                          {entry.services.map((service) => <span key={service}>{service}</span>)}
                        </div>
                      )}
                      <dl className="historyFacts">
                        <div><dt>Location</dt><dd>{entry.location ?? "Any location"}</dd></div>
                        <div><dt>Schedule</dt><dd>{scheduleLabel(entry)}</dd></div>
                        <div><dt>Budget</dt><dd>{budgetLabel(entry)}</dd></div>
                        <div><dt>Results</dt><dd>{entry.resultCount === null ? "Not recorded" : `${entry.resultCount} found`}</dd></div>
                      </dl>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}

          <aside className="historyPrivacyNote">
            <span aria-hidden="true">✓</span>
            <p>
              Aylo stores only encrypted request references in an HttpOnly cookie;
              request text stays in the private database. History is limited to
              this browser and expires after 30 days without a new saved search.
              Forgetting history removes browser access, not database records.
            </p>
          </aside>
        </>
      )}
    </main>
  );
}
