"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { LeadInbox } from "@/app/components/lead-inbox";
import type {
  LeadApiResponse,
  LeadFilter,
  LeadInboxData,
} from "@/types/lead";

type LoadOptions = {
  businessId?: string;
  status: LeadFilter;
  token: string;
};

export default function LeadsPage() {
  const [data, setData] = useState<LeadInboxData | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [status, setStatus] = useState<LeadFilter>("pending_confirmation");
  const [operatorToken, setOperatorToken] = useState("");
  const [needsAccess, setNeedsAccess] = useState(false);
  const [configurationMissing, setConfigurationMissing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async ({ businessId, status, token }: LoadOptions) => {
    setLoading(true);
    setError(null);
    setAccessError(null);

    try {
      const query = new URLSearchParams({ status });
      if (businessId) query.set("businessId", businessId);
      const headers: HeadersInit = {};
      if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      const response = await fetch(`/api/leads?${query.toString()}`, {
        cache: "no-store",
        headers,
      });
      const result = (await response.json()) as LeadApiResponse;

      if (!result.ok) {
        if (result.code === "LEAD_ACCESS_REQUIRED") {
          setData(null);
          setNeedsAccess(true);
          setConfigurationMissing(false);
          if (token.trim()) setAccessError(result.error);
          return;
        }

        if (result.code === "LEAD_ACCESS_NOT_CONFIGURED") {
          setData(null);
          setNeedsAccess(false);
          setConfigurationMissing(true);
          return;
        }

        throw new Error(result.error);
      }

      if (!response.ok) throw new Error("Lead inbox could not be loaded.");
      const { ok: _ok, ...nextData } = result;
      setData(nextData);
      setSelectedBusinessId(nextData.selectedBusinessId ?? "");
      setStatus(nextData.filter);
      setNeedsAccess(false);
      setConfigurationMissing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lead inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads({ status: "pending_confirmation", token: "" });
  }, [loadLeads]);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operatorToken.trim().length < 32) {
      setAccessError("Use the 32+ character token from AYLO_OPERATOR_TOKEN.");
      return;
    }
    void loadLeads({ status, token: operatorToken });
  }

  function lockInbox() {
    setData(null);
    setOperatorToken("");
    setNeedsAccess(true);
    setAccessError(null);
    setError(null);
  }

  return (
    <main className="businessShell dashboardShell leadShell">
      <header className="businessHeader dashboardHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/dashboard" className="backLink">Dashboard</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/services" className="backLink">Services</Link>
            <Link href="/availability" className="backLink">Availability</Link>
          </div>
          <p className="eyebrow">Aylo Business</p>
          <h1>Lead inbox</h1>
          <p>Review incoming booking requests before taking action.</p>
        </div>
        {data && (
          <span className={`dashboardHeaderBadge ${data.source}`}>
            {data.source === "operations" && "Live inbox"}
            {data.source === "catalog" && "Catalog only"}
            {data.source === "demo" && "Demo leads"}
          </span>
        )}
      </header>

      {needsAccess && (
        <form className="leadAccessCard" onSubmit={unlock}>
          <div className="leadAccessIcon" aria-hidden="true">◇</div>
          <div>
            <p className="eyebrow">Private operations</p>
            <h2>Unlock the live lead inbox</h2>
            <p>
              Enter the value configured as <code>AYLO_OPERATOR_TOKEN</code>.
              It stays in this page&apos;s memory and is not saved in browser storage.
            </p>
            <label htmlFor="operator-token">Operator token</label>
            <div className="leadAccessFields">
              <input
                id="operator-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={operatorToken}
                onChange={(event) => setOperatorToken(event.target.value)}
                placeholder="32+ character token"
              />
              <button type="submit" disabled={loading}>
                {loading ? "Checking…" : "Unlock inbox"}
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
        <section className="leadToolbar" aria-label="Lead inbox controls">
          <label htmlFor="lead-business">
            <span>Business</span>
            <select
              id="lead-business"
              value={selectedBusinessId}
              disabled={loading}
              onChange={(event) => {
                const businessId = event.target.value;
                setSelectedBusinessId(businessId);
                void loadLeads({ businessId, status, token: operatorToken });
              }}
            >
              {data.businesses.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button
              type="button"
              className="leadRefresh"
              disabled={loading}
              onClick={() => void loadLeads({
                businessId: selectedBusinessId || undefined,
                status,
                token: operatorToken,
              })}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {data.source === "operations" && (
              <button type="button" className="leadLock" onClick={lockInbox}>
                Lock inbox
              </button>
            )}
          </div>
        </section>
      )}

      <div className="dashboardLiveStatus" aria-live="polite">
        {loading && !data && !needsAccess && "Loading lead inbox…"}
        {loading && data && "Refreshing leads…"}
        {error && <span className="error">{error}</span>}
      </div>

      {data && (
        <LeadInbox
          data={data}
          loading={loading}
          onFilterChange={(nextStatus) => {
            setStatus(nextStatus);
            void loadLeads({
              businessId: selectedBusinessId || undefined,
              status: nextStatus,
              token: operatorToken,
            });
          }}
        />
      )}
    </main>
  );
}
