"use client";

import Link from "next/link";
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { consumerBookingStatusText } from "@/lib/bookings/status";
import {
  formatBakuDateTime,
  formatDuration,
  providerInitials,
} from "@/lib/search/presentation";
import type {
  ConsumerBooking,
  ConsumerBookingCancellationApiResponse,
  ConsumerRescheduleOption,
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
  const [pendingCancellation, setPendingCancellation] =
    useState<ConsumerBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [cancellationNotice, setCancellationNotice] = useState<string | null>(null);
  const cancellationDialogRef = useRef<HTMLDivElement>(null);
  const cancellationHeadingRef = useRef<HTMLHeadingElement>(null);
  const [pendingReschedule, setPendingReschedule] = useState<ConsumerBooking | null>(null);
  const [rescheduleOptions, setRescheduleOptions] = useState<ConsumerRescheduleOption[]>([]);
  const [chosenOption, setChosenOption] = useState<ConsumerRescheduleOption | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const rescheduleHeadingRef = useRef<HTMLHeadingElement>(null);
  const rescheduleDialogRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!pendingCancellation) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancellationHeadingRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [pendingCancellation]);

  useEffect(() => {
    if (!pendingReschedule) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rescheduleHeadingRef.current?.focus();
    return () => { document.body.style.overflow = overflow; focused?.focus(); };
  }, [pendingReschedule]);

  async function openReschedule(booking: ConsumerBooking) {
    if (!booking.rescheduleToken) return;
    setPendingReschedule(booking);
    setRescheduleOptions([]);
    setChosenOption(null);
    setRescheduleError(null);
    setCancellationNotice(null);
    setRescheduleBusy(true);
    try {
      const response = await fetch("/api/bookings/reschedule/options", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionToken: booking.rescheduleToken }),
      });
      const result = await response.json() as
        | { ok: true; options: ConsumerRescheduleOption[] }
        | { ok: false; error: string };
      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("Could not load available times.");
      setRescheduleOptions(result.options);
    } catch (caught) {
      setRescheduleError(caught instanceof Error ? caught.message : "Could not load available times.");
    } finally { setRescheduleBusy(false); }
  }

  function closeReschedule() {
    if (rescheduleBusy) return;
    setPendingReschedule(null);
    setRescheduleError(null);
    setChosenOption(null);
  }

  function handleRescheduleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeReschedule(); return; }
    if (event.key !== "Tab" || !rescheduleDialogRef.current) return;
    const focusable = Array.from(rescheduleDialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === rescheduleHeadingRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  async function confirmReschedule() {
    const booking = pendingReschedule;
    const selected = chosenOption;
    if (!booking || !selected || rescheduleBusy) return;
    setRescheduleBusy(true);
    setRescheduleError(null);
    try {
      const response = await fetch("/api/bookings/reschedule", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionToken: selected.optionToken, confirmed: true }),
      });
      const result = await response.json() as
        | { ok: true; reference: string; bookedFor: string; status: "pending_confirmation" }
        | { ok: false; error: string };
      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("The booking could not be rescheduled.");
      setData((current) => current ? { ...current, entries: current.entries.map((entry) =>
        entry.reference === booking.reference && entry.createdAt === booking.createdAt
          ? { ...entry, bookedFor: result.bookedFor, status: result.status,
            merchantRespondedAt: null, cancellationToken: null, rescheduleToken: null }
          : entry,
      ) } : current);
      setCancellationNotice(`Booking ${result.reference} moved to ${appointmentLabel(result.bookedFor)}. The provider must confirm the new time.`);
      setPendingReschedule(null);
      void loadBookings();
    } catch (caught) {
      setRescheduleError(caught instanceof Error ? caught.message : "The booking could not be rescheduled.");
    } finally { setRescheduleBusy(false); }
  }

  function requestCancellation(booking: ConsumerBooking) {
    if (!booking.cancellationToken) return;
    setCancellationError(null);
    setCancellationNotice(null);
    setPendingCancellation(booking);
  }

  function closeCancellation() {
    if (cancelling) return;
    setPendingCancellation(null);
    setCancellationError(null);
  }

  function handleCancellationKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCancellation();
      return;
    }
    if (event.key !== "Tab" || !cancellationDialogRef.current) return;
    const focusable = Array.from(
      cancellationDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === cancellationHeadingRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmCancellation() {
    const booking = pendingCancellation;
    const actionToken = booking?.cancellationToken;
    if (!booking || !actionToken || cancelling) return;
    setCancelling(true);
    setCancellationError(null);

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionToken, confirmed: true }),
      });
      const result = (await response.json()) as
        ConsumerBookingCancellationApiResponse;
      if (!result.ok) throw new Error(result.error);
      if (!response.ok) throw new Error("The booking could not be cancelled.");

      setData((current) => current ? {
        ...current,
        entries: current.entries.map((entry) =>
          entry.reference === booking.reference &&
          entry.createdAt === booking.createdAt
            ? { ...entry, status: result.status, cancellationToken: null }
            : entry
        ),
      } : current);
      setCancellationNotice(
        result.changed
          ? `Booking ${result.reference} was cancelled and its slot was released.`
          : `Booking ${result.reference} was already cancelled.`,
      );
      setPendingCancellation(null);
    } catch (caught) {
      setCancellationError(
        caught instanceof Error
          ? caught.message
          : "The booking could not be cancelled.",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="businessShell consumerBookingsShell">
      <header className="businessHeader consumerBookingsHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/history" className="backLink">Request history</Link>
          </div>
          <p className="eyebrow">Aylo · Day 33</p>
          <h1>My bookings</h1>
          <p>Track provider decisions and manage future bookings from this browser.</p>
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

      {cancellationNotice && (
        <section className="consumerBookingsNotice" role="status">
          <span aria-hidden="true">✓</span>
          {cancellationNotice}
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
                        <div className="consumerBookingTiming">
                          <span>
                            Requested {safeDateLabel(booking.createdAt, "date unavailable")}
                          </span>
                          {booking.merchantRespondedAt && (
                            <strong>
                              Provider responded {safeDateLabel(booking.merchantRespondedAt, "date unavailable")}
                            </strong>
                          )}
                        </div>
                        {(booking.cancellationToken || booking.rescheduleToken) && (
                          <div className="consumerBookingActions">
                            {booking.rescheduleToken && (
                              <button type="button" className="consumerBookingRescheduleAction"
                                onClick={() => void openReschedule(booking)}>
                                Change time
                              </button>
                            )}
                            {booking.cancellationToken && (
                              <button
                                type="button"
                                className="consumerBookingCancelAction"
                                onClick={() => requestCancellation(booking)}
                              >
                                Cancel booking
                              </button>
                            )}
                          </div>
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
              this list, but does not delete database records. Cancellation uses
              a separate encrypted action token that expires after 10 minutes.
            </p>
          </aside>
        </>
      )}

      {pendingCancellation && (
        <div
          className="consumerCancellationBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancellation();
          }}
        >
          <div
            className="consumerCancellationDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consumer-cancellation-title"
            aria-describedby="consumer-cancellation-description"
            ref={cancellationDialogRef}
            onKeyDown={handleCancellationKeyDown}
          >
            <p className="eyebrow">Final confirmation</p>
            <h2
              id="consumer-cancellation-title"
              ref={cancellationHeadingRef}
              tabIndex={-1}
            >
              Cancel this booking?
            </h2>
            <p id="consumer-cancellation-description">
              This releases the appointment for someone else. Aylo cannot restore
              the booking after cancellation.
            </p>

            <dl className="consumerCancellationSummary">
              <div>
                <dt>Provider</dt>
                <dd>{pendingCancellation.businessName}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{pendingCancellation.serviceName}</dd>
              </div>
              <div>
                <dt>Appointment</dt>
                <dd>{appointmentLabel(pendingCancellation.bookedFor)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{priceLabel(pendingCancellation)}</dd>
              </div>
            </dl>

            <div className="consumerCancellationWarning">
              <span aria-hidden="true">!</span>
              <div>
                <strong>The slot becomes available again</strong>
                <small>
                  Cancellation is written only after the server rechecks this
                  browser, booking state, appointment, and slot.
                </small>
              </div>
            </div>

            {cancellationError && (
              <p className="consumerCancellationError" role="alert">
                {cancellationError}
              </p>
            )}

            <div className="consumerCancellationActions">
              <button
                type="button"
                onClick={closeCancellation}
                disabled={cancelling}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="confirm"
                onClick={() => void confirmCancellation()}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingReschedule && (
        <div className="consumerCancellationBackdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeReschedule();
        }}>
          <div className="consumerCancellationDialog" role="dialog" aria-modal="true"
            aria-labelledby="reschedule-title" aria-describedby="reschedule-description"
            ref={rescheduleDialogRef} onKeyDown={handleRescheduleKeyDown}>
            <p className="eyebrow">Change appointment</p>
            <h2 id="reschedule-title" tabIndex={-1} ref={rescheduleHeadingRef}>Choose a new time</h2>
            <p id="reschedule-description">
              {pendingReschedule.businessName} · {pendingReschedule.serviceName}. Current appointment: {appointmentLabel(pendingReschedule.bookedFor)}.
              The provider will need to confirm your new time.
            </p>
            {rescheduleBusy && !chosenOption && <p role="status">Loading available times…</p>}
            {!rescheduleBusy && rescheduleOptions.length === 0 && !rescheduleError &&
              <p role="status">No other times available in the next 30 days.</p>}
            {rescheduleOptions.length > 0 && (
              <fieldset className="consumerRescheduleOptions" disabled={rescheduleBusy}>
                <legend>Available times · Baku time</legend>
                {rescheduleOptions.map((option) => (
                  <label key={option.optionToken}>
                    <input type="radio" name="new-booking-time"
                      checked={chosenOption?.optionToken === option.optionToken}
                      onChange={() => setChosenOption(option)} />
                    {appointmentLabel(option.bookedFor)}
                  </label>
                ))}
              </fieldset>
            )}
            {chosenOption && <div className="consumerCancellationWarning" role="status">
              <span aria-hidden="true">!</span>
              <div><strong>Final confirmation</strong><small>
                Move from {appointmentLabel(pendingReschedule.bookedFor)} to {appointmentLabel(chosenOption.bookedFor)}?
                Your existing time will be released and provider acceptance will reset.
              </small></div>
            </div>}
            {rescheduleError && <p className="consumerCancellationError" role="alert">{rescheduleError}</p>}
            <div className="consumerCancellationActions">
              <button type="button" onClick={closeReschedule} disabled={rescheduleBusy}>Keep current time</button>
              <button type="button" className="confirm" onClick={() => void confirmReschedule()}
                disabled={!chosenOption || rescheduleBusy}>
                {rescheduleBusy ? "Changing…" : "Confirm new time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
