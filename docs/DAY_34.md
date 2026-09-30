# Day 34 — Personal calendar export

The **Download calendar file** action appears for future, accepted live
bookings with a valid reserved slot end time. It downloads a `.ics` event
that can be imported into a personal calendar app. The booking page refreshes
private booking data immediately before export, so a booking cancelled,
rescheduled, or rejected since the last automatic refresh does not generate a
stale confirmed event.

The event contains its actual slot start and end in UTC, the service,
provider, address (when available), and only the short booking reference. UTC
times display in the calendar app's own time zone, including Baku. The
generator escapes calendar text and folds UTF-8 lines to 75 octets. It writes
no API token, full booking ID, request ID, price, or personal contact data.

An imported event is a **snapshot**. If the booking later changes or is
cancelled, the user must update or remove that calendar event manually. The
page states this after downloading. No email, push notification, database
migration, or new environment variable is required. Demo and catalog modes
remain unavailable for private booking actions.

## Verification

```bash
npm run test:booking-status
npm test
npm run typecheck
npm run build
```

In live mode, accept a future booking, open `/bookings`, download and import
the calendar file, and compare its start/end time with the booked slot. A
pending, rejected, cancelled, expired, or missing-end-time booking must not
show the action. Reschedule or cancel an accepted booking before clicking an
older open page and verify it refuses to export the stale event.
