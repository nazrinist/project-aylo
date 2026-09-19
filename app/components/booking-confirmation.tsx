"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  BookingConfirmation as ConfirmedBooking,
  BookingSubmissionResult,
  PersistedBooking,
} from "@/types/booking";
import type { BookableSearchResult, SearchResult } from "@/types/search";
import {
  confirmBookingDraft,
  createBookingDraft,
} from "@/lib/bookings/confirmation";
import {
  formatBakuDateTime,
  formatDuration,
  providerInitials,
} from "@/lib/search/presentation";

type BookingConfirmationProps = {
  offer: BookableSearchResult;
  requestId: string | null;
  confirmedBooking: ConfirmedBooking | null;
  persistedBooking: PersistedBooking | null;
  onConfirm: (
    confirmation: ConfirmedBooking,
  ) => Promise<BookingSubmissionResult>;
  onClose: () => void;
};

function OfferSummary({ offer }: { offer: SearchResult }) {
  return (
    <>
      <div className="bookingOfferHero">
        <span aria-hidden="true">{providerInitials(offer.businessName)}</span>
        <div>
          <strong>{offer.businessName}</strong>
          <small>{offer.serviceName}</small>
        </div>
        {offer.verified && <b>✓ Verified</b>}
      </div>

      <dl className="bookingSummary">
        <div>
          <dt>Date &amp; time</dt>
          <dd>{formatBakuDateTime(offer.availableTime)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(offer.durationMinutes)}</dd>
        </div>
        <div>
          <dt>Total price</dt>
          <dd>{offer.price} {offer.currency}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{offer.address}</dd>
        </div>
      </dl>
    </>
  );
}

export function BookingConfirmation({
  offer,
  requestId,
  confirmedBooking,
  persistedBooking,
  onConfirm,
  onClose,
}: BookingConfirmationProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isConfirmed = confirmedBooking?.availabilityId === offer.id;
  const isPersisted = persistedBooking?.availabilityId === offer.id;
  const persistenceAvailable = Boolean(requestId && offer.bookingToken);

  useEffect(() => {
    setAcknowledged(false);
    setSubmitting(false);
    setSaveError(null);
  }, [offer.id]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [offer.id]);

  useEffect(() => {
    if (isConfirmed) headingRef.current?.focus();
  }, [isConfirmed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!submitting) onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submitConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged || submitting) return;
    const draft = createBookingDraft(offer, requestId);
    setSubmitting(true);
    setSaveError(null);

    try {
      await onConfirm(confirmBookingDraft(draft, new Date().toISOString()));
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The booking could not be created. Please try again",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="bookingBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="bookingDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-heading"
        aria-describedby="booking-description"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          className="bookingClose"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close booking confirmation"
        >
          ×
        </button>

        {isConfirmed ? (
          <div className="bookingSuccess" aria-live="polite">
            <div className="bookingSuccessIcon" aria-hidden="true">✓</div>
            <p className="eyebrow">
              {isPersisted ? "Booking created" : "Local confirmation"}
            </p>
            <h2 id="booking-heading" ref={headingRef} tabIndex={-1}>
              {isPersisted ? "Booking request created" : "Booking details confirmed"}
            </h2>
            <p id="booking-description">
              {isPersisted
                ? "The slot is secured and waiting for provider confirmation."
                : "Your explicit confirmation is captured for this browser session."}
            </p>

            <OfferSummary offer={offer} />

            <div className={`bookingPendingNotice${isPersisted ? " saved" : ""}`}>
              <strong>
                {isPersisted ? "Pending provider confirmation" : "Not saved in demo mode"}
              </strong>
              {isPersisted
                ? "Aylo rechecked the offer, created the private booking, and marked the slot booked."
                : "Connect Supabase and run the Day 16 migration to persist bookings."}
              {isPersisted && persistedBooking && (
                <small>Reference · {persistedBooking.id.slice(0, 8).toUpperCase()}</small>
              )}
            </div>

            <div className="bookingDialogActions single">
              <button type="button" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <p className="eyebrow">Final review</p>
            <h2 id="booking-heading" ref={headingRef} tabIndex={-1}>
              Confirm booking details
            </h2>
            <p id="booking-description" className="bookingDescription">
              Check the provider, date, time, and total before you continue.
            </p>

            <div className="bookingGuardrail">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>You stay in control</strong>
                <small>Nothing is booked until you explicitly confirm below.</small>
              </div>
            </div>

            <OfferSummary offer={offer} />

            <form onSubmit={submitConfirmation}>
              <label className="bookingConsent">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={submitting}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I checked the provider, service, date, time, location, and
                  price shown above.
                </span>
              </label>

              {saveError && (
                <div className="bookingSaveError" role="alert">
                  {saveError}
                </div>
              )}

              <div className="bookingDialogActions">
                <button
                  type="button"
                  className="bookingCancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={!acknowledged || submitting}>
                  {submitting
                    ? "Creating booking…"
                    : persistenceAvailable
                      ? "Confirm & create booking"
                      : "Confirm demo details"}
                </button>
              </div>
            </form>

            <p className="bookingPersistenceNote">
              {persistenceAvailable
                ? "Aylo will recheck the signed offer and available slot on the server before writing anything."
                : "Persistence is unavailable for this search; confirmation will stay in this browser session and is not sent to the provider."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
