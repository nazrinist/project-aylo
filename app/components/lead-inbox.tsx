import type {
  LeadDecision,
  LeadFilter,
  LeadInboxData,
  LeadSource,
  LeadStatus,
  LeadSummary,
} from "@/types/lead";

type LeadInboxProps = {
  data: LeadInboxData;
  loading: boolean;
  decidingReference: string | null;
  onFilterChange: (filter: LeadFilter) => void;
  onDecisionRequest: (lead: LeadSummary, decision: LeadDecision) => void;
};

const filterOptions: { value: LeadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_confirmation", label: "New" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const appointmentFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const receivedFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function sourceLabel(source: LeadSource) {
  if (source === "operations") return "Live inbox";
  if (source === "catalog") return "Catalog only";
  return "Demo leads";
}

function sourceDescription(source: LeadSource) {
  if (source === "operations") {
    return "Live bookings from Supabase, reduced to the fields needed for triage.";
  }
  if (source === "catalog") {
    return "Public catalog mode cannot read private bookings.";
  }
  return "Sample leads only. No real customer or booking data is shown.";
}

function statusLabel(status: LeadStatus) {
  if (status === "pending_confirmation") return "New lead";
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  return "Cancelled";
}

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "Price not set";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(price)} ${currency}`;
}

export function LeadInbox({
  data,
  loading,
  decidingReference,
  onFilterChange,
  onDecisionRequest,
}: LeadInboxProps) {
  const selectedBusiness = data.businesses.find(
    (business) => business.id === data.selectedBusinessId,
  );

  return (
    <div className="leadInbox">
      <section className="leadSummaryCard" aria-label="Lead inbox summary">
        <div>
          <span className={`leadSourceBadge ${data.source}`}>
            {sourceLabel(data.source)}
          </span>
          <p className="eyebrow">Selected business</p>
          <h2>{selectedBusiness?.name ?? "No business selected"}</h2>
          <p>{sourceDescription(data.source)}</p>
        </div>
        <div className="leadSummaryMetrics">
          <span>
            <small>New leads</small>
            <strong>{data.counts.pending_confirmation ?? "—"}</strong>
          </span>
          <span>
            <small>All leads</small>
            <strong>{data.counts.all ?? "—"}</strong>
          </span>
        </div>
      </section>

      {!data.leadsAvailable ? (
        <section className="leadUnavailable">
          <span aria-hidden="true">◇</span>
          <div>
            <p className="eyebrow">Private data unavailable</p>
            <h2>Live leads need server-side operator access.</h2>
            <p>
              Add <code>SUPABASE_SECRET_KEY</code> and a strong
              {" "}<code>AYLO_OPERATOR_TOKEN</code>, then restart the server.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="leadFilters" aria-label="Filter leads by status">
            {filterOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={data.filter === option.value ? "active" : ""}
                aria-pressed={data.filter === option.value}
                disabled={loading}
                onClick={() => onFilterChange(option.value)}
              >
                <span>{option.label}</span>
                <strong>{data.counts[option.value] ?? "—"}</strong>
              </button>
            ))}
          </section>

          {data.resultsLimited && (
            <p className="leadLimitNotice">
              Showing the newest 50 matching leads. Narrow the status filter to
              review a smaller queue.
            </p>
          )}

          {data.leads.length === 0 ? (
            <section className="leadEmptyState">
              <span aria-hidden="true">✓</span>
              <h2>No leads in this view</h2>
              <p>The selected business has no matching booking requests.</p>
            </section>
          ) : (
            <section className="leadList" aria-label="Booking leads">
              {data.leads.map((lead) => (
                <article className="leadCard" key={lead.reference}>
                  <header>
                    <span className={`leadStatus ${lead.status}`}>
                      {statusLabel(lead.status)}
                    </span>
                    <span className="leadReference">Ref · {lead.reference}</span>
                  </header>

                  <div className="leadCardMain">
                    <div className="leadServiceIdentity">
                      <span aria-hidden="true">↗</span>
                      <div>
                        <p className="eyebrow">Requested service</p>
                        <h2>{lead.serviceName}</h2>
                        <time dateTime={lead.bookedFor}>
                          {appointmentFormatter.format(new Date(lead.bookedFor))}
                          {" · Baku time"}
                        </time>
                      </div>
                    </div>
                    <strong className="leadPrice">
                      {formatPrice(lead.price, lead.currency)}
                    </strong>
                  </div>

                  <dl className="leadFacts">
                    <div>
                      <dt>Received</dt>
                      <dd>
                        <time dateTime={lead.receivedAt}>
                          {receivedFormatter.format(new Date(lead.receivedAt))}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Appointment</dt>
                      <dd>
                        <time dateTime={lead.bookedFor}>
                          {appointmentFormatter.format(new Date(lead.bookedFor))}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{statusLabel(lead.status)}</dd>
                    </div>
                  </dl>

                  <footer>
                    <span>Customer identity and request text are not included.</span>
                    {lead.status === "pending_confirmation" && lead.actionToken ? (
                      <div className="leadActions" aria-label={`Actions for ${lead.reference}`}>
                        <button
                          type="button"
                          className="leadRejectAction"
                          disabled={loading || decidingReference === lead.reference}
                          onClick={() => onDecisionRequest(lead, "rejected")}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="leadAcceptAction"
                          disabled={loading || decidingReference === lead.reference}
                          onClick={() => onDecisionRequest(lead, "accepted")}
                        >
                          Accept
                        </button>
                      </div>
                    ) : (
                      <strong>
                        {lead.status === "pending_confirmation"
                          ? "Actions unavailable"
                          : "Decision recorded"}
                      </strong>
                    )}
                  </footer>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      <aside className="leadPrivacyNote">
        <span aria-hidden="true">i</span>
        <p>
          This inbox only exposes service, appointment, price, status, and a
          short reference. It never loads <code>user_id</code> or the original
          request text.
        </p>
      </aside>
    </div>
  );
}
