"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardOverview } from "@/app/components/dashboard-overview";
import type { DashboardApiResponse, DashboardData } from "@/types/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (businessId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const query = businessId
        ? `?businessId=${encodeURIComponent(businessId)}`
        : "";
      const response = await fetch(`/api/dashboard${query}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as DashboardApiResponse;

      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("Dashboard could not be loaded.");

      const { ok: _ok, ...nextData } = result;
      setData(nextData);
      setSelectedBusinessId(nextData.dashboard?.business.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="businessShell dashboardShell">
      <header className="businessHeader dashboardHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/leads" className="backLink">Leads</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/services" className="backLink">Services</Link>
            <Link href="/availability" className="backLink">Availability</Link>
          </div>
          <p className="eyebrow">Aylo Business</p>
          <h1>Dashboard</h1>
          <p>A privacy-safe view of catalog readiness and upcoming operations.</p>
        </div>
        {data && (
          <span className={`dashboardHeaderBadge ${data.source}`}>
            {data.source === "operations" && "Live operations"}
            {data.source === "catalog" && "Catalog only"}
            {data.source === "demo" && "Demo data"}
          </span>
        )}
      </header>

      {data && data.businesses.length > 0 && (
        <section className="dashboardToolbar" aria-label="Dashboard controls">
          <label htmlFor="dashboard-business">
            <span>Business</span>
            <select
              id="dashboard-business"
              value={selectedBusinessId}
              disabled={loading}
              onChange={(event) => {
                const businessId = event.target.value;
                setSelectedBusinessId(businessId);
                void loadDashboard(businessId);
              }}
            >
              {data.businesses.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="dashboardRefresh"
            disabled={loading}
            onClick={() => void loadDashboard(selectedBusinessId || undefined)}
          >
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </section>
      )}

      <div className="dashboardLiveStatus" aria-live="polite">
        {loading && !data && "Loading dashboard…"}
        {loading && data && "Refreshing dashboard data…"}
        {error && <span className="error">{error}</span>}
      </div>

      {!loading && !error && data?.dashboard === null && (
        <section className="dashboardBlankState">
          <p className="eyebrow">No businesses yet</p>
          <h2>Create a business to start the dashboard.</h2>
          <Link href="/businesses">Add a business →</Link>
        </section>
      )}

      {data?.dashboard && (
        <DashboardOverview
          summary={data.dashboard}
          source={data.source}
          privateMetrics={data.privateMetrics}
        />
      )}
    </main>
  );
}
