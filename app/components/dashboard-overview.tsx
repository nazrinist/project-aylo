import Link from "next/link";
import type {
  DashboardSource,
  DashboardSummary,
} from "@/types/dashboard";

type DashboardOverviewProps = {
  summary: DashboardSummary;
  source: DashboardSource;
  privateMetrics: boolean;
};

const bakuDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const bakuTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function sourceLabel(source: DashboardSource) {
  if (source === "operations") return "Live operations";
  if (source === "catalog") return "Catalog view";
  return "Demo preview";
}

function sourceDescription(source: DashboardSource) {
  if (source === "operations") {
    return "Live catalog and privacy-safe booking totals.";
  }
  if (source === "catalog") {
    return "Public catalog data only. Private booking totals stay hidden.";
  }
  return "Local sample data. No real bookings or private metrics are shown.";
}

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "Price not set";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(price)} ${currency}`;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "Duration not set";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  return (
    <article className={`dashboardMetric ${value === null ? "unavailable" : ""}`}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function DashboardOverview({
  summary,
  source,
  privateMetrics,
}: DashboardOverviewProps) {
  const { business, metrics, readiness, services, upcomingSlots } = summary;
  const privateMetricDetail = privateMetrics
    ? summary.window.label
    : "Unavailable in this data mode";

  return (
    <div className="dashboardOverview">
      <section className="dashboardProfileGrid" aria-label="Business profile status">
        <article className="dashboardProfileCard">
          <div className="dashboardProfileTopline">
            <span className={`dashboardSourceBadge ${source}`}>
              {sourceLabel(source)}
            </span>
            <span className={`dashboardVerifyState ${business.verified ? "on" : "off"}`}>
              {business.verified ? "Verified" : "Not verified"}
            </span>
          </div>
          <div className="dashboardIdentity">
            <span aria-hidden="true">{business.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <p className="eyebrow">Selected business</p>
              <h2>{business.name}</h2>
              <p>{business.address || "Address not added"}</p>
            </div>
          </div>
          <div className="dashboardProfileMeta">
            <span>
              <small>Rating</small>
              <strong>{business.rating === null ? "Not rated" : `★ ${business.rating.toFixed(1)}`}</strong>
            </span>
            <span>
              <small>Data scope</small>
              <strong>{sourceLabel(source)}</strong>
            </span>
          </div>
          <p className="dashboardSourceNote">{sourceDescription(source)}</p>
        </article>

        <article className="dashboardReadinessCard">
          <div className="dashboardCardHeading">
            <div>
              <p className="eyebrow">Profile readiness</p>
              <h2>{readiness.completed} of {readiness.total} complete</h2>
            </div>
            <strong>{Math.round((readiness.completed / readiness.total) * 100)}%</strong>
          </div>
          <progress value={readiness.completed} max={readiness.total}>
            {readiness.completed} of {readiness.total}
          </progress>
          <ul className="dashboardChecklist">
            {readiness.items.map((item) => (
              <li key={item.id} className={item.complete ? "complete" : "incomplete"}>
                <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
                {item.label}
                <small>{item.complete ? "Done" : "Needs attention"}</small>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="dashboardSection" aria-labelledby="dashboard-metrics-title">
        <div className="dashboardSectionHeading">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2 id="dashboard-metrics-title">{summary.window.label}</h2>
          </div>
          <span>Times shown in Baku time</span>
        </div>
        <div className="dashboardMetricGrid">
          <MetricCard
            label="Active services"
            value={metrics.activeServices}
            detail={`${metrics.totalServices} total services`}
          />
          <MetricCard
            label="Open slots"
            value={metrics.openSlots}
            detail={summary.window.label}
          />
          <MetricCard
            label="Pending bookings"
            value={metrics.pendingBookings}
            detail={privateMetricDetail}
          />
          <MetricCard
            label="Booked slots"
            value={metrics.bookedSlots}
            detail={privateMetricDetail}
          />
        </div>
      </section>

      <section className="dashboardContentGrid">
        <article className="dashboardPanel" aria-labelledby="dashboard-services-title">
          <div className="dashboardPanelHeading">
            <div>
              <p className="eyebrow">Catalog</p>
              <h2 id="dashboard-services-title">Services</h2>
            </div>
            <Link href="/services">Manage →</Link>
          </div>
          {services.length === 0 ? (
            <p className="dashboardEmpty">No services yet. Add the first service to become searchable.</p>
          ) : (
            <ul className="dashboardServiceList">
              {services.map((service) => (
                <li key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>{formatDuration(service.durationMinutes)}</span>
                  </div>
                  <div>
                    <strong>{formatPrice(service.price, service.currency)}</strong>
                    <span className={`dashboardStatus ${service.active ? "available" : "blocked"}`}>
                      {service.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboardPanel" aria-labelledby="dashboard-slots-title">
          <div className="dashboardPanelHeading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2 id="dashboard-slots-title">Upcoming slots</h2>
            </div>
            <Link href="/availability">Manage →</Link>
          </div>
          {upcomingSlots.length === 0 ? (
            <p className="dashboardEmpty">No upcoming slots in this window.</p>
          ) : (
            <ul className="dashboardSlotList">
              {upcomingSlots.map((slot) => (
                <li key={slot.id}>
                  <time dateTime={slot.startTime}>
                    {bakuDateTime.format(new Date(slot.startTime))}
                  </time>
                  <div>
                    <strong>{slot.serviceName}</strong>
                    <span>Until {bakuTime.format(new Date(slot.endTime))}</span>
                  </div>
                  <span className={`dashboardStatus ${slot.status}`}>{slot.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="dashboardQuickActions" aria-labelledby="dashboard-actions-title">
        <div>
          <p className="eyebrow">Quick actions</p>
          <h2 id="dashboard-actions-title">Keep the catalog ready</h2>
        </div>
        <nav aria-label="Dashboard quick actions">
          <Link href="/leads">Open lead inbox</Link>
          <Link href="/businesses">Edit profile</Link>
          <Link href="/services">Manage services</Link>
          <Link href="/availability">Add availability</Link>
        </nav>
      </section>

      <aside className="dashboardNextDay">
        <span>Day 19</span>
        <div>
          <strong>Lead decisions are ready</strong>
          <p>Accept or reject pending leads with an explicit, re-authorized confirmation.</p>
        </div>
        <Link href="/leads">Open inbox →</Link>
      </aside>
    </div>
  );
}
