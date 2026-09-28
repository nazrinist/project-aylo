import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Public beta privacy | Aylo",
  description: "What Aylo stores during the public beta and why.",
};

export default function PrivacyPage() {
  return (
    <main className="privacyShell">
      <article className="privacyCard">
        <nav className="privacyNav" aria-label="Privacy page navigation">
          <Link href="/" className="backLink">← Aylo</Link>
          <span>Public beta · 28 September 2026</span>
        </nav>

        <p className="eyebrow">Privacy & fair use</p>
        <h1>A small data footprint for a useful beta.</h1>
        <p className="privacyLead">
          Aylo is an early beauty-booking product. You can try it without an
          account, and the beta is designed to collect only what the product
          needs to search, create a booking request, and learn from feedback.
        </p>

        <section>
          <h2>Private browser sessions</h2>
          <p>
            Public beta access uses a random participant ID inside an encrypted,
            HttpOnly cookie that expires after seven days. It supports feedback
            and fair-use request limits. The beta tables do not store your name,
            email, phone number, IP address, or browser user-agent.
          </p>
        </section>

        <section>
          <h2>Searches and bookings</h2>
          <p>
            In live mode, a validated search can be saved privately so Aylo can
            show browser history and connect an explicitly confirmed offer to a
            booking request. The same encrypted browser references authorize the
            My bookings status page without exposing full request or booking IDs.
            Providers receive only the service, appointment, price, status, and
            short reference needed to handle that request.
            Aylo does not collect payment during this beta.
          </p>
        </section>

        <section>
          <h2>Preferences and feedback</h2>
          <p>
            Optional location and budget preferences stay in an encrypted
            browser cookie. Structured feedback stores the outcome, a 1–5 ease
            rating, and an optional note. Do not put names, contact details,
            health information, or payment information in that note.
          </p>
        </section>

        <section>
          <h2>Fair use</h2>
          <p>
            Public sessions have short request limits to protect availability
            and AI cost for other testers. Counters are attached to the random
            beta participant ID—not an IP address—and reset automatically by
            time window. Clearing cookies can start a new session, so these
            limits are a beta safeguard rather than identity verification.
          </p>
        </section>

        <div className="privacyCallout">
          <strong>Keep the request practical.</strong>
          <span>
            Aylo V1 supports non-medical beauty services in Baku. Always review
            provider, time, location, and price before confirming.
          </span>
        </div>

        <Link href="/" className="privacyCta">Try Aylo →</Link>
      </article>
    </main>
  );
}
