"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LeadInbox } from "@/app/components/lead-inbox";
import {
  applyDemoLeadDecisions,
  type DemoLeadDecisionRecord,
} from "@/lib/leads/shared";
import type {
  LeadApiResponse,
  LeadDecision,
  LeadDecisionApiResponse,
  LeadFilter,
  LeadInboxData,
  LeadSummary,
} from "@/types/lead";

type LoadOptions = {
  businessId?: string;
  status: LeadFilter;
  token: string;
};

type PendingDecision = {
  lead: LeadSummary;
  decision: LeadDecision;
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
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const demoDecisions = useRef<Record<string, DemoLeadDecisionRecord>>({});

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
      const { ok: _ok, ...loadedData } = result;
      const nextData = applyDemoLeadDecisions(
        loadedData,
        Object.values(demoDecisions.current),
      );
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
    setPendingDecision(null);
    setDecisionError(null);
    setDecisionNotice(null);
  }

  function requestDecision(lead: LeadSummary, decision: LeadDecision) {
    if (lead.status !== "pending_confirmation" || !lead.actionToken) return;
    setDecisionError(null);
    setDecisionNotice(null);
    setPendingDecision({ lead, decision });
  }

  async function confirmDecision() {
    if (!pendingDecision || !data?.selectedBusinessId) return;

    setDecisionLoading(true);
    setDecisionError(null);
    setDecisionNotice(null);

    try {
      if (data.source === "demo") {
        const key = `${data.selectedBusinessId}:${pendingDecision.lead.reference}`;
        demoDecisions.current[key] = {
          businessId: data.selectedBusinessId,
          lead: pendingDecision.lead,
          decision: pendingDecision.decision,
        };
        const decision = pendingDecision.decision;
        setPendingDecision(null);
        await loadLeads({
          businessId: data.selectedBusinessId,
          status,
          token: operatorToken,
        });
        setDecisionNotice(
          `Demo lead ${decision === "accepted" ? "accepted" : "rejected"}. No database row was changed.`,
        );
        return;
      }

      if (data.source !== "operations") {
        throw new Error("Live lead actions are unavailable in catalog mode.");
      }

      const response = await fetch("/api/leads/decision", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${operatorToken.trim()}`,
        },
        body: JSON.stringify({
          actionToken: pendingDecision.lead.actionToken,
          decision: pendingDecision.decision,
          confirmed: true,
        }),
      });
      const result = (await response.json()) as LeadDecisionApiResponse;

      if (!result.ok) {
        if (result.code === "LEAD_ACCESS_REQUIRED") {
          lockInbox();
          setAccessError(result.error);
          return;
        }
        if (result.code === "LEAD_ACCESS_NOT_CONFIGURED") {
          setData(null);
          setOperatorToken("");
          setNeedsAccess(false);
          setConfigurationMissing(true);
          setPendingDecision(null);
          return;
        }
        throw new Error(result.error);
      }

      if (!response.ok) throw new Error("The lead decision could not be saved.");
      const decision = result.status;
      const changed = result.changed;
      setPendingDecision(null);
      await loadLeads({
        businessId: data.selectedBusinessId,
        status,
        token: operatorToken,
      });
      setDecisionNotice(
        changed
          ? `Lead ${decision === "accepted" ? "accepted" : "rejected"} successfully.`
          : `This lead was already ${decision}.`,
      );
    } catch (caught) {
      setDecisionError(
        caught instanceof Error
          ? caught.message
          : "The lead decision could not be saved.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  return (
    <main className="businessShell dashboardShell leadShell">
      <header className="businessHeader dashboardHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/dashboard" className="backLink">Dashboard</Link>
            <Link href="/analytics" className="backLink">Analytics</Link>
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
                setPendingDecision(null);
                setDecisionError(null);
                setDecisionNotice(null);
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
        {decisionError && <span className="error">{decisionError}</span>}
        {decisionNotice && <span className="leadDecisionSuccess">{decisionNotice}</span>}
      </div>

      {data && (
        <LeadInbox
          data={data}
          loading={loading}
          decidingReference={
            decisionLoading ? pendingDecision?.lead.reference ?? null : null
          }
          onFilterChange={(nextStatus) => {
            setStatus(nextStatus);
            setPendingDecision(null);
            setDecisionError(null);
            void loadLeads({
              businessId: selectedBusinessId || undefined,
              status: nextStatus,
              token: operatorToken,
            });
          }}
          onDecisionRequest={requestDecision}
        />
      )}

      {pendingDecision && (
        <div className="leadDecisionBackdrop">
          <section
            className={`leadDecisionDialog ${pendingDecision.decision}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-decision-title"
            aria-describedby="lead-decision-description"
          >
            <p className="eyebrow">Final confirmation</p>
            <h2 id="lead-decision-title">
              {pendingDecision.decision === "accepted"
                ? "Accept this lead?"
                : "Reject this lead?"}
            </h2>
            <p id="lead-decision-description">
              {pendingDecision.decision === "accepted"
                ? "The appointment will be marked accepted and its slot will stay reserved."
                : "The booking will be marked rejected and a future appointment slot will become available again."}
              {" "}This final decision cannot be switched from this inbox.
            </p>
            <dl className="leadDecisionSummary">
              <div>
                <dt>Service</dt>
                <dd>{pendingDecision.lead.serviceName}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{pendingDecision.lead.reference}</dd>
              </div>
            </dl>
            <p className="leadDecisionAuthNote">
              The operator token is checked again when this decision is saved.
            </p>
            {decisionError && (
              <p className="leadDecisionDialogError" role="alert">
                {decisionError}
              </p>
            )}
            <div className="leadDecisionDialogActions">
              <button
                type="button"
                disabled={decisionLoading}
                onClick={() => setPendingDecision(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  pendingDecision.decision === "accepted"
                    ? "leadAcceptAction"
                    : "leadRejectAction"
                }
                disabled={decisionLoading}
                onClick={() => void confirmDecision()}
              >
                {decisionLoading
                  ? "Saving…"
                  : pendingDecision.decision === "accepted"
                    ? "Confirm acceptance"
                    : "Confirm rejection"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
