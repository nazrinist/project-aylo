"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { consumerBookingStatusText } from "@/lib/bookings/status";
import {
  formatBakuDateTime,
  formatDuration,
  providerInitials,
} from "@/lib/search/presentation";
import type {
  ConsumerBooking,
  ConsumerBookingsApiResponse,
  ConsumerBookingsData,
} from "@/types/booking";

const responseTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function safeDateLabel(value: string, fallback: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : responseTimeFormatter.format(date);
}

function appointmentLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : formatBakuDateTime(value);
}

function priceLabel(booking: ConsumerBooking) {
  if (booking.price === null) return "Price unavailable";
  const price = Number.isInteger(booking.price)
    ? booking.price.toString()
    : booking.price.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${price} ${booking.currency}`;
}

export default function ConsumerBookingsPage() {
  const [data, setData] = useState<ConsumerBookingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", { cache: "no-store" });
      const result = (await response.json()) as ConsumerBookingsApiResponse;
      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("Booking status could not be loaded.");
      const { ok: _ok, ...bookings } = result;
      setData(bookings);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Booking status could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
    const refreshTimer = window.setInterval(() => void loadBookings(), 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadBookings]);

  return (
    <main className="businessShell consumerBookingsShell">
      <header className="businessHeader consumerBookingsHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/history" className="backLink">Request history</Link>
          </div>
          <p className="eyebrow">Aylo · Day 31</p>
          <h1>My bookings</h1>
          <p>Track provider decisions for bookings created on this browser.</p>
        </div>
        {data?.bookingsAvailable && (
          <span className="consumerBookingsHeaderBadge">
            {data.entries.length} booking{data.entries.length === 1 ? "" : "s"}
          </span>
        )}
      </header>

      {loading && !data && (
        <section className="consumerBookingsLoading" aria-live="polite">
          Loading private booking status…
        </section>
      )}

      {error && (
        <section className="consumerBookingsError" role="alert">
          <div>
            <strong>Booking status is unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => void loadBookings()} disabled={loading}>
            Try again
          </button>
        </section>
      )}

      {data && !data.bookingsAvailable && (
        <section className="consumerBookingsUnavailable">
          <span aria-hidden="true">◇</span>
          <div>
            <p className="eyebrow">Private persistence is off</p>
            <h2>Booking status stays hidden in {data.source} mode.</h2>
            <p>
              Live status needs the server-side Supabase secret key. Demo and
              public catalog modes never invent provider decisions.
            </p>
          </div>
        </section>
      )}

      {data?.bookingsAvailable && (
        <>
          <section className="consumerBookingsToolbar">
            <div>
              <p className="eyebrow">This browser only</p>
              <strong>
                {data.entries.length === 0
                  ? "No tracked bookings"
                  : `${data.entries.length} tracked booking${data.entries.length === 1 ? "" : "s"}`}
              </strong>
              <small>Status refreshes automatically every minute.</small>
            </div>
            <button
              type="button"
              onClick={() => void loadBookings()}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
          </section>

          {data.entries.length === 0 ? (
            <section className="consumerBookingsEmptyState">
              <span aria-hidden="true">+</span>
              <h2>No bookings on this browser yet</h2>
              <p>Confirm a live offer and its provider status will appear here.</p>
              <Link href="/">Find a provider →</Link>
            </section>
          ) : (
            <ol className="consumerBookingsList">
              {data.entries.map((booking) => {
                const status = consumerBookingStatusText(booking.status);
                return (
                  <li key={`${booking.reference}:${booking.createdAt}`}>
                    <article className="consumerBookingCard">
                      <header>
                        <span className={`consumerBookingStatus ${booking.status}`}>
                          {status.label}
                        </span>
                        <span className="consumerBookingReference">
                          Booking {booking.reference}
                        </span>
                      </header>

                      <div className="consumerBookingCardBody">
                        <div className="consumerBookingIdentity">
                          <span aria-hidden="true">
                            {providerInitials(booking.businessName)}
                          </span>
                          <div>
                            <p className="eyebrow">{booking.businessName}</p>
                            <h2>{booking.serviceName}</h2>
                          </div>
                          <strong>{priceLabel(booking)}</strong>
                        </div>

                        <div className={`consumerBookingDecision ${booking.status}`}>
                          <strong>{status.label}</strong>
                          <span>{status.detail}</span>
                        </div>

                        <dl className="consumerBookingFacts">
                          <div>
                            <dt>Appointment</dt>
                            <dd>{appointmentLabel(booking.bookedFor)}</dd>
                          </div>
                          <div>
                            <dt>Duration</dt>
                            <dd>{formatDuration(booking.durationMinutes)}</dd>
                          </div>
                          <div>
                            <dt>Location</dt>
                            <dd>{booking.address ?? "Location unavailable"}</dd>
                          </div>
                        </dl>
                      </div>

                      <footer>
                        <span>
                          Requested {safeDateLabel(booking.createdAt, "date unavailable")}
                        </span>
                        {booking.merchantRespondedAt && (
                          <strong>
                            Provider responded {safeDateLabel(booking.merchantRespondedAt, "date unavailable")}
                          </strong>
                        )}
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}

          <aside className="consumerBookingsPrivacyNote">
            <span aria-hidden="true">✓</span>
            <p>
              Aylo authorizes this list with encrypted request references in an
              HttpOnly cookie. Full booking and request IDs never reach this
              page. Access stays on this browser and expires after 30 days
              without a new saved search. Forgetting request history also hides
              this list, but does not delete database records.
            </p>
          </aside>
        </>
      )}
    </main>
  );
}
