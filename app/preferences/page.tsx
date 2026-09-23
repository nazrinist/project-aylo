"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type {
  PreferencesApiResponse,
  SearchPreferences,
} from "@/types/preferences";

const EMPTY_FORM = { location: "", budgetMax: "", currency: "AZN" };

function formValues(preferences: SearchPreferences) {
  return {
    location: preferences.location ?? "",
    budgetMax: preferences.budgetMax?.toString() ?? "",
    currency: preferences.currency,
  };
}

export default function PreferencesPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/preferences", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as PreferencesApiResponse;
        if (!response.ok || !data.ok) throw new Error(data.ok ? "Preferences could not be loaded." : data.error);
        if (active) {
          setConfigured(data.configured);
          setForm(formValues(data.preferences));
        }
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Preferences could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: form.location.trim() || null,
          budgetMax: form.budgetMax.trim() ? Number(form.budgetMax) : null,
          currency: form.currency,
        }),
      });
      const data = (await response.json()) as PreferencesApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.ok ? "Preferences could not be saved." : data.error);
      setForm(formValues(data.preferences));
      setMessage("Preferences saved for this browser.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function clearPreferences() {
    if (!window.confirm("Clear saved preferences from this browser?")) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/preferences", { method: "DELETE" });
      if (!response.ok) throw new Error("Preferences could not be cleared.");
      setForm(EMPTY_FORM);
      setMessage("Saved preferences cleared.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preferences could not be cleared.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="businessShell preferencesShell">
      <header className="businessHeader preferencesHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/history" className="backLink">Request history</Link>
          </div>
          <p className="eyebrow">Aylo · Day 23</p>
          <h1>Search preferences</h1>
          <p>Set optional defaults for requests from this browser.</p>
        </div>
        <span className="preferencesHeaderBadge">Browser private</span>
      </header>

      {loading ? (
        <section className="historyLoading" aria-live="polite">Loading search preferences…</section>
      ) : configured === false ? (
        <section className="preferencesUnavailable">
          <span aria-hidden="true">◇</span>
          <div>
            <p className="eyebrow">Encrypted storage is off</p>
            <h2>Add a preferences secret</h2>
            <p>Add a 32+ character <code>PREFERENCES_SECRET</code> to <code>.env.local</code>, then restart the server. Search still works without preferences.</p>
          </div>
        </section>
      ) : (
        <form className="preferencesCard" onSubmit={save}>
          <div className="preferencesIntro">
            <div>
              <p className="eyebrow">Optional defaults</p>
              <h2>Make repeat searches faster</h2>
            </div>
            <p>Aylo uses these values only when your request leaves them out. A value written in your request always wins.</p>
          </div>

          <div className="preferencesFields">
            <label>
              <span>Default location</span>
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Ağ Şəhər, Bakı"
                minLength={2}
                maxLength={120}
              />
              <small>Used only when a request has no area or location.</small>
            </label>
            <label>
              <span>Maximum budget</span>
              <div className="preferencesBudget">
                <input
                  type="number"
                  value={form.budgetMax}
                  onChange={(event) => setForm((current) => ({ ...current, budgetMax: event.target.value }))}
                  placeholder="120"
                  min="1"
                  max="1000000"
                  step="0.01"
                />
                <select
                  aria-label="Budget currency"
                  value={form.currency}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                >
                  <option value="AZN">AZN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <small>Used only when a request has no minimum or maximum budget.</small>
            </label>
          </div>

          {error && <div className="preferencesMessage error" role="alert">{error}</div>}
          {message && <div className="preferencesMessage success" aria-live="polite">{message}</div>}

          <div className="preferencesActions">
            <button type="button" className="preferencesClear" onClick={() => void clearPreferences()} disabled={saving}>Clear saved values</button>
            <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
          </div>
        </form>
      )}

      <aside className="preferencesPrivacyNote">
        <span aria-hidden="true">✓</span>
        <p>Preferences are encrypted in an HttpOnly cookie, are limited to this browser, and expire after 180 days. Aylo does not save a default service or date, so an old preference cannot silently choose what or when to book.</p>
      </aside>
    </main>
  );
}
