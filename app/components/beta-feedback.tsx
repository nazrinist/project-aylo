"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BetaFeedbackOutcome } from "@/types/beta";

type BetaStatus = {
  mode: "open" | "closed";
  authenticated: boolean;
};

const outcomeLabels: Record<BetaFeedbackOutcome, string> = {
  booking_created: "I created a booking request",
  useful_options: "I found useful options",
  no_match: "I could not find a match",
  technical_issue: "A technical issue stopped me",
};

export function BetaFeedback() {
  const [enabled, setEnabled] = useState(false);
  const [outcome, setOutcome] = useState<BetaFeedbackOutcome>("useful_options");
  const [easeRating, setEaseRating] = useState("4");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/beta/access", { cache: "no-store" })
      .then(async (response) => response.json() as Promise<BetaStatus>)
      .then((status) => {
        if (active) setEnabled(status.mode === "closed" && status.authenticated);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => { active = false; };
  }, []);

  if (!enabled) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outcome,
          easeRating: Number(easeRating),
          comment: comment.trim() || undefined,
        }),
      });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Feedback could not be saved.");
      }
      setComment("");
      setMessage("Thank you — your beta feedback was saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="betaFeedback" aria-labelledby="beta-feedback-title">
      <div className="betaFeedbackIntro">
        <div>
          <p className="eyebrow">Closed beta feedback</p>
          <h2 id="beta-feedback-title">How did this search go?</h2>
        </div>
        <span>Pseudonymous browser session</span>
      </div>
      <form onSubmit={submit}>
        <label>
          Outcome
          <select value={outcome} onChange={(event) => setOutcome(event.target.value as BetaFeedbackOutcome)}>
            {Object.entries(outcomeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Ease of use
          <select value={easeRating} onChange={(event) => setEaseRating(event.target.value)}>
            <option value="5">5 — Very easy</option>
            <option value="4">4 — Easy</option>
            <option value="3">3 — Okay</option>
            <option value="2">2 — Difficult</option>
            <option value="1">1 — Very difficult</option>
          </select>
        </label>
        <label className="betaFeedbackComment">
          Optional note
          <textarea
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What helped, or where did you get stuck?"
          />
          <small>Do not include names, contact details, health, or payment information.</small>
        </label>
        <button disabled={saving}>{saving ? "Sending…" : "Send feedback"}</button>
      </form>
      {message && <p className="betaFeedbackMessage success" role="status">{message}</p>}
      {error && <p className="betaFeedbackMessage error" role="alert">{error}</p>}
    </section>
  );
}
