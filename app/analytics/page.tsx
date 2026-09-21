"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { AnalyticsOverview } from "@/app/components/analytics-overview";
import type {
  AnalyticsApiResponse,
  AnalyticsData,
  AnalyticsRange,
} from "@/types/analytics";

type LoadOptions = {
  businessId?: string;
  range: AnalyticsRange;
  token: string;
};

const rangeOptions: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [operatorToken, setOperatorToken] = useState("");
  const [needsAccess, setNeedsAccess] = useState(false);
  const [configurationMissing, setConfigurationMissing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async ({
    businessId,
    range: nextRange,
    token,
  }: LoadOptions) => {
    setLoading(true);
    setError(null);
    setAccessError(null);

    try {
      const query = new URLSearchParams({ range: nextRange });
      if (businessId) query.set("businessId", businessId);
      const headers: HeadersInit = {};
      if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      const response = await fetch(`/api/analytics?${query.toString()}`, {
        cache: "no-store",
        headers,
      });
      const result = (await response.json()) as AnalyticsApiResponse;

      if (!result.ok) {
        if (result.code === "ANALYTICS_ACCESS_REQUIRED") {
          setData(null);
          setNeedsAccess(true);
          setConfigurationMissing(false);
          if (token.trim()) setAccessError(result.error);
          return;
        }

        if (result.code === "ANALYTICS_ACCESS_NOT_CONFIGURED") {
          setData(null);
          setNeedsAccess(false);
          setConfigurationMissing(true);
          return;
        }

        throw new Error(result.error);
      }

      if (!response.ok) throw new Error("Analytics could not be loaded.");
      const { ok: _ok, ...loadedData } = result;
      setData(loadedData);
      setSelectedBusinessId(loadedData.selectedBusinessId ?? "");
      setRange(loadedData.range);
      setNeedsAccess(false);
      setConfigurationMissing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Analytics could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics({ range: "30d", token: "" });
  }, [loadAnalytics]);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operatorToken.trim().length < 32) {
      setAccessError("Use the 32+ character token from AYLO_OPERATOR_TOKEN.");
      return;
    }
    void loadAnalytics({ range, token: operatorToken });
  }

  function lockAnalytics() {
    setData(null);
    setOperatorToken("");
    setNeedsAccess(true);
    setAccessError(null);
    setError(null);
  }

  return (
    <main className="businessShell dashboardShell analyticsShell">
      <header className="businessHeader dashboardHeader analyticsHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/dashboard" className="backLink">Dashboard</Link>
            <Link href="/leads" className="backLink">Leads</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/services" className="backLink">Services</Link>
            <Link href="/availability" className="backLink">Availability</Link>
          </div>
          <p className="eyebrow">Aylo Business · Day 21</p>
          <h1>Basic analytics</h1>
          <p>
            Understand lead demand and booking decisions without exposing customer data.
          </p>
        </div>
        {data && (
          <span className={`dashboardHeaderBadge ${data.source}`}>
            {data.source === "operations" && "Live analytics"}
            {data.source === "catalog" && "Catalog only"}
            {data.source === "demo" && "Demo analytics"}
          </span>
        )}
      </header>

      {needsAccess && (
        <form className="leadAccessCard" onSubmit={unlock}>
          <div className="leadAccessIcon" aria-hidden="true">◇</div>
          <div>
            <p className="eyebrow">Private operations</p>
            <h2>Unlock live analytics</h2>
            <p>
              Enter the value configured as <code>AYLO_OPERATOR_TOKEN</code>.
              It stays in this page&apos;s memory and is not saved in browser storage.
            </p>
            <label htmlFor="analytics-operator-token">Operator token</label>
            <div className="leadAccessFields">
              <input
                id="analytics-operator-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={operatorToken}
                onChange={(event) => setOperatorToken(event.target.value)}
                placeholder="32+ character token"
              />
              <button type="submit" disabled={loading}>
                {loading ? "Checking…" : "Unlock analytics"}
              </button>
            </div>
            {accessError && <p className="leadAccessError">{accessError}</p>}
          </div>
        </form>
      )}

      {configurationMissing && (
        <section className="leadConfigurationCard">
          <p className="eyebrow">Setup required</p>
          <h2>Operator access is not configured.</h2>
          <p>
            Add a random 32+ character <code>AYLO_OPERATOR_TOKEN</code> to
            {" "}<code>.env.local</code>, then restart the development server.
          </p>
        </section>
      )}

      {data && data.businesses.length > 0 && (
        <section className="analyticsToolbar" aria-label="Analytics controls">
          <label htmlFor="analytics-business">
            <span>Business</span>
            <select
              id="analytics-business"
              value={selectedBusinessId}
              disabled={loading}
              onChange={(event) => {
                const businessId = event.target.value;
                setSelectedBusinessId(businessId);
                void loadAnalytics({ businessId, range, token: operatorToken });
              }}
            >
              {data.businesses.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="analytics-range">
            <span>Range</span>
            <select
              id="analytics-range"
              value={range}
              disabled={loading}
              onChange={(event) => {
                const nextRange = event.target.value as AnalyticsRange;
                setRange(nextRange);
                void loadAnalytics({
                  businessId: selectedBusinessId || undefined,
                  range: nextRange,
                  token: operatorToken,
                });
              }}
            >
              {rangeOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="analyticsToolbarActions">
            <button
              type="button"
              className="leadRefresh"
              disabled={loading}
              onClick={() => void loadAnalytics({
                businessId: selectedBusinessId || undefined,
                range,
                token: operatorToken,
              })}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {data.source === "operations" && (
              <button type="button" className="leadLock" onClick={lockAnalytics}>
                Lock analytics
              </button>
            )}
          </div>
        </section>
      )}

      <div className="dashboardLiveStatus" aria-live="polite">
        {loading && !data && !needsAccess && "Loading analytics…"}
        {loading && data && "Refreshing analytics…"}
        {error && <span className="error">{error}</span>}
      </div>

      {data && <AnalyticsOverview data={data} />}
    </main>
  );
}
