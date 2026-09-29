# Day 33 — Change a booking time

The original browser can change a future pending or accepted booking to an
available time for the same provider and service. The dialog shows both times
and requires **Confirm new time**.

## Setup

Run the **contents** of `supabase/migrations/0014_consumer_booking_reschedule.sql`
in Supabase SQL Editor after `0013_consumer_booking_cancellation.sql`, then
restart the server. The migration adds an audit timestamp and a service-role-only
function. It does not delete rows, drop tables, or require a new environment
variable.

## Rules

- Only future `pending_confirmation` and `accepted` bookings can change.
- The options API returns up to 12 future available slots in the next 30 days
  for the same provider and service. It returns an opaque ten-minute token per
  option, never booking, request, or slot IDs.
- The server checks both the encrypted history cookie and token again on every
  request. The SQL function locks the request, booking, old slot, and chosen
  slot; rechecks ownership, state, original time, provider and service; then
  moves the booking and releases the old slot in one transaction.
- A previously accepted booking returns to `pending_confirmation`, and the
  old provider response timestamp clears. The provider must accept the new
  time. The original agreed price stays with the booking.
- Closing the dialog or choosing **Keep current time** writes nothing. A
  stale token, occupied slot, cancelled booking, or past booking cannot move.
- Replaying a successful option fails because its expected original time and
  last change timestamp no longer match, even after an A→B→A sequence.

## Verify

```bash
npm run test:booking-status
npm test
npm run typecheck
npm run build
```

In live mode, create a future booking and open `/bookings`. Choose **Change
time**, select a different slot, and confirm. Verify the new slot is booked,
the old one is available, and the booking is waiting for provider confirmation.
Try an accepted booking, a stale option, and a second browser. Demo and catalog
modes continue to show private booking management as unavailable.
