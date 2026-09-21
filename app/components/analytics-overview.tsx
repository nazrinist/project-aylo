import type { CSSProperties } from "react";
import type {
  AnalyticsData,
  AnalyticsMoneyTotal,
  AnalyticsSource,
} from "@/types/analytics";

type AnalyticsOverviewProps = {
  data: AnalyticsData;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function sourceLabel(source: AnalyticsSource) {
  if (source === "operations") return "Live analytics";
  if (source === "catalog") return "Catalog only";
  return "Demo analytics";
}

function sourceDescription(source: AnalyticsSource) {
  if (source === "operations") {
    return "Live booking aggregates from Supabase. Customer and request details stay excluded.";
  }
  if (source === "catalog") {
    return "Public catalog access cannot read private booking performance.";
  }
  return "Deterministic sample metrics only. No real booking or customer data is shown.";
}

function moneyLabel(totals: AnalyticsMoneyTotal[]) {
  if (totals.length === 0) return "—";
  return totals
    .map((total) => `${numberFormatter.format(total.amount)} ${total.currency}`)
    .join(" · ");
}

function rateLabel(value: number | null) {
  return value === null ? "—" : `${numberFormatter.format(value)}%`;
}

function hoursLabel(value: number | null) {
  return value === null ? "—" : `${numberFormatter.format(value)} hr`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="analyticsMetric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function AnalyticsOverview({ data }: AnalyticsOverviewProps) {
  const selectedBusiness = data.businesses.find(
    (business) => business.id === data.selectedBusinessId,
  );

  if (!data.analyticsAvailable) {
    return (
      <section className="analyticsUnavailable">
        <span aria-hidden="true">◇</span>
        <div>
          <p className="eyebrow">Private data unavailable</p>
          <h2>Analytics stay hidden in catalog mode.</h2>
          <p>
            Live analytics need server-side Supabase admin access and a valid
            {" "}<code>AYLO_OPERATOR_TOKEN</code>. Public keys can only load the catalog.
          </p>
        </div>
      </section>
    );
  }

  if (!data.summary) {
    return (
      <section className="analyticsEmptyState">
        <span aria-hidden="true">+</span>
        <h2>No business selected</h2>
        <p>Create a business before viewing analytics.</p>
      </section>
    );
  }

  const { summary } = data;
  const { metrics, statusCounts } = summary;
  const statusRows = [
    ["New", statusCounts.pendingConfirmation, "pending"],
    ["Accepted", statusCounts.accepted, "accepted"],
    ["Rejected", statusCounts.rejected, "rejected"],
    ["Cancelled", statusCounts.cancelled, "cancelled"],
  ] as const;
  const maxStatus = Math.max(1, ...statusRows.map(([, count]) => count));
  const maxDaily = Math.max(
    1,
    ...summary.dailyTrend.map((point) => point.totalLeads),
  );
  const labelEvery =
    summary.window.days <= 7 ? 1 : summary.window.days <= 30 ? 5 : 15;

  return (
    <div className="analyticsOverview">
      <section className="analyticsSummaryCard">
        <div>
          <span className={`analyticsSourceBadge ${data.source}`}>
            {sourceLabel(data.source)}
          </span>
          <p className="eyebrow">Selected business</p>
          <h2>{selectedBusiness?.name ?? summary.business.name}</h2>
          <p>{sourceDescription(data.source)}</p>
        </div>
        <div className="analyticsWindow">
          <small>Reporting window</small>
          <strong>{summary.window.label}</strong>
          <span>{summary.window.startDate} – {summary.window.endDate}</span>
          <em>Baku time</em>
        </div>
      </section>

      <section className="analyticsMetricGrid" aria-label="Analytics summary">
        <MetricCard
          label="Total leads"
          value={metrics.totalLeads}
          detail="Bookings created in this window"
        />
        <MetricCard
          label="Accepted"
          value={metrics.acceptedBookings}
          detail="Accepted booking requests"
        />
        <MetricCard
          label="Acceptance rate"
          value={rateLabel(metrics.acceptanceRate)}
          detail="Accepted ÷ accepted plus rejected"
        />
        <MetricCard
          label="Accepted booking value"
          value={moneyLabel(metrics.acceptedValue)}
          detail="Not collected revenue or payment"
        />
        <MetricCard
          label="Average response"
          value={hoursLabel(metrics.averageResponseHours)}
          detail="Accepted and rejected leads only"
        />
      </section>

      <section className="analyticsInsightGrid">
        <article className="analyticsPanel" aria-labelledby="analytics-status-title">
          <div className="analyticsPanelHeading">
            <div>
              <p className="eyebrow">Decision mix</p>
              <h2 id="analytics-status-title">Lead status</h2>
            </div>
            <span>{statusCounts.all} total</span>
          </div>
          <div className="analyticsStatusList">
            {statusRows.map(([label, count, status]) => (
              <div key={status}>
                <div>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
                <div className="analyticsStatusTrack" aria-hidden="true">
                  <i
                    className={status}
                    style={{ width: `${(count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="analyticsPanel" aria-labelledby="analytics-trend-title">
          <div className="analyticsPanelHeading">
            <div>
              <p className="eyebrow">Demand</p>
              <h2 id="analytics-trend-title">Daily leads</h2>
            </div>
            <span>Green = accepted</span>
          </div>
          <div className="analyticsTrendScroll">
            <div
              className="analyticsTrendPlot"
              role="list"
              aria-label="Daily lead and accepted-booking trend"
              style={{
                gridTemplateColumns: `repeat(${summary.dailyTrend.length}, minmax(16px, 1fr))`,
              }}
            >
              {summary.dailyTrend.map((point, index) => {
                const totalHeight = point.totalLeads === 0
                  ? 2
                  : Math.max(10, (point.totalLeads / maxDaily) * 100);
                const acceptedHeight = point.totalLeads === 0
                  ? 0
                  : (point.acceptedBookings / point.totalLeads) * 100;
                const showLabel =
                  index % labelEvery === 0 || index === summary.dailyTrend.length - 1;

                return (
                  <div
                    className="analyticsTrendDay"
                    key={point.date}
                    role="listitem"
                    aria-label={`${point.date}: ${point.totalLeads} leads, ${point.acceptedBookings} accepted`}
                  >
                    <div className="analyticsTrendBar">
                      <i style={{ height: `${totalHeight}%` } as CSSProperties}>
                        <b style={{ height: `${acceptedHeight}%` } as CSSProperties} />
                      </i>
                    </div>
                    <time dateTime={point.date}>{showLabel ? point.date.slice(5) : ""}</time>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="analyticsPanel analyticsServices" aria-labelledby="analytics-services-title">
        <div className="analyticsPanelHeading">
          <div>
            <p className="eyebrow">Service performance</p>
            <h2 id="analytics-services-title">Top services by lead volume</h2>
          </div>
          <span>Top 5</span>
        </div>
        {summary.services.length === 0 ? (
          <p className="analyticsEmpty">No leads were created in this window.</p>
        ) : (
          <div className="analyticsTableScroll">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Leads</th>
                  <th>Accepted</th>
                  <th>Acceptance</th>
                  <th>Accepted value</th>
                </tr>
              </thead>
              <tbody>
                {summary.services.map((service) => (
                  <tr key={service.serviceId ?? service.serviceName}>
                    <th scope="row">{service.serviceName}</th>
                    <td>{service.totalLeads}</td>
                    <td>{service.acceptedBookings}</td>
                    <td>{rateLabel(service.acceptanceRate)}</td>
                    <td>{moneyLabel(service.acceptedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="analyticsPrivacyNote">
        <span aria-hidden="true">✓</span>
        <p>
          Analytics contain aggregate booking performance only. Customer identity,
          request text, user IDs, booking IDs, and payment claims are excluded.
        </p>
      </aside>
    </div>
  );
}
