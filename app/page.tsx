"use client";

import { FormEvent, useState } from "react";

type IntentResult = Record<string, unknown>;

export default function Home() {
  const [request, setRequest] = useState("");
  const [result, setResult] = useState<IntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Request failed");
      setResult(data.intent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">AYLO <span>alpha</span></div>
        <h1>What do you need?</h1>
        <p className="subtitle">Tell Aylo. We turn your intent into action.</p>

        <form className="intentBox" onSubmit={submit}>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Tomorrow at 6, find me hair + makeup near White City under 120 AZN…"
            rows={4}
          />
          <div className="actions">
            <span>V1 · Beauty services</span>
            <button disabled={loading || request.trim().length < 3}>
              {loading ? "Understanding…" : "Find it →"}
            </button>
          </div>
        </form>

        {error && <div className="panel error">{error}</div>}
        {result && (
          <div className="panel">
            <div className="panelTitle">Structured intent</div>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </section>
    </main>
  );
}
