"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Aylo page failed", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className="stateShell">
      <section className="stateCard" role="alert">
        <p className="eyebrow">Temporary problem</p>
        <h1>Aylo could not load this page.</h1>
        <p>Your data was not changed. Try the page again.</p>
        <button type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
