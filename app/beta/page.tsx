"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type BetaStatus = {
  ok: boolean;
  mode: "open" | "closed" | "public";
  configured: boolean;
  authenticated: boolean;
  participantReady: boolean;
  expiresAt: number | null;
  error?: string;
};

export default function BetaAccessPage() {
  const [status, setStatus] = useState<BetaStatus | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/beta/access", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as BetaStatus;
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setError("Beta status could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/beta/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json() as BetaStatus;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Beta access could not be started.");
      }
      setCode("");
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beta access could not be started.");
    } finally {
      setSaving(false);
    }
  }

  async function leaveBeta() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/beta/access", { method: "DELETE" });
      if (!response.ok) throw new Error("The beta session could not be cleared.");
      setStatus((current) => current ? { ...current, authenticated: false, expiresAt: null } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The beta session could not be cleared.");
    } finally {
      setSaving(false);
    }
  }

  const expiresLabel = status?.expiresAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
        .format(new Date(status.expiresAt))
    : null;

  return (
    <main className="betaShell">
      <section className="betaAccessCard">
        <div className="betaBrand">AYLO <span>public beta</span></div>
        <p className="eyebrow">Day 30 · Public beta</p>
        <h1>Aylo is open for testing.</h1>
        <p className="betaIntro">
          Search for a beauty appointment in Baku, compare real options, and
          tell us where the flow helps or gets stuck. No account is required.
        </p>

        {loading && <div className="betaMessage">Checking access…</div>}

        {!loading && status?.mode === "open" && (
          <div className="betaOpenState">
            <strong>Local preview mode is active.</strong>
            <span>The public-beta session and launch limits are disabled here.</span>
            <Link href="/">Enter Aylo →</Link>
          </div>
        )}

        {!loading && status?.mode === "public" && status.configured && (
          <div className="betaOpenState">
            <strong>Public beta is live.</strong>
            <span>
              Entry is open. Aylo uses a private seven-day browser session for
              feedback and fair-use request limits.
            </span>
            <Link href="/">Try Aylo →</Link>
          </div>
        )}

        {!loading && status?.mode === "public" && !status.configured && (
          <div className="betaMessage error" role="alert">
            Public beta is enabled but not configured. The operator must add
            the Day 30 environment values and restart the server.
          </div>
        )}

        {!loading && status?.mode === "closed" && !status.configured && (
          <div className="betaMessage error" role="alert">
            Closed beta is enabled but not configured. The operator must add
            the Day 29 environment values and restart the server.
          </div>
        )}

        {!loading && status?.mode === "closed" && status.authenticated && (
          <div className="betaActiveState">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Beta access is active</strong>
              <small>{expiresLabel ? `Session expires ${expiresLabel}` : "Session is ready"}</small>
            </div>
            <Link href="/">Continue →</Link>
            <button type="button" disabled={saving} onClick={leaveBeta}>Leave beta</button>
          </div>
        )}

        {!loading && status?.mode === "closed" && status.configured && !status.authenticated && (
          <form className="betaAccessForm" onSubmit={submit}>
            <label htmlFor="beta-code">Invite code</label>
            <div>
              <input
                id="beta-code"
                type="password"
                required
                minLength={16}
                maxLength={128}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter your private invite code"
                autoComplete="one-time-code"
              />
              <button disabled={saving || code.trim().length < 16}>
                {saving ? "Checking…" : "Enter beta →"}
              </button>
            </div>
          </form>
        )}

        {error && <div className="betaMessage error" role="alert">{error}</div>}

        <div className="betaPrivacyNote">
          <span aria-hidden="true">i</span>
          <p>
            Aylo uses an encrypted, HttpOnly seven-day session. Invite codes
            are never stored in browser storage, and beta tables do not store
            your email, IP address, or browser user-agent. See the{" "}
            <Link href="/privacy">beta privacy note</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
