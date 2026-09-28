import Link from "next/link";

export default function NotFound() {
  return (
    <main className="stateShell">
      <section className="stateCard">
        <p className="eyebrow">404</p>
        <h1>This page is not part of Aylo.</h1>
        <p>Return to the public beta and start a beauty-service search.</p>
        <Link href="/">Go to Aylo →</Link>
      </section>
    </main>
  );
}
