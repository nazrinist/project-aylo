# Day 32 — Consumer booking cancellation

Day 32 lets the same browser that created a live booking cancel a future
pending or accepted appointment from `/bookings`. Cancellation is an explicit,
final action: Aylo rechecks ownership and current database state, changes the
booking and request lifecycle, and releases the appointment slot in one
transaction.

## Lifecycle rules

| Current booking state | Future appointment | Result |
| --- | --- | --- |
| `pending_confirmation` | Yes | Cancel and release slot |
| `accepted` | Yes | Cancel and release slot |
| `cancelled` | Any | Safe idempotent success |
| `rejected` | Any | `409 BOOKING_NOT_CANCELLABLE` |
| Pending or accepted | No | `409 BOOKING_EXPIRED` |

The cancellation dialog names the provider, service, appointment, and price,
and states that the slot becomes available again. Closing the dialog, pressing
Escape, or choosing **Keep booking** performs no write.

## Two-part browser authorization

The browser never submits a booking or request ID.

1. `GET /api/bookings` reads the authenticated Day 22 history cookie and
   returns a ten-minute AES-256-GCM action token only for a future pending or
   accepted booking.
2. `POST /api/bookings/cancel` decrypts that token on the server and separately
   decrypts the history cookie.
3. The database function receives the opaque token's booking ID plus the
   cookie-authorized request-ID set, then requires the booking to belong to one
   of those requests.

A copied action token is therefore insufficient without the same valid browser
history cookie. Modified, expired, or cross-browser tokens receive the same
generic `403` response. Full IDs never enter page code, URLs, browser storage,
or API responses.

## Atomic database mutation

Run the full contents of this file in Supabase SQL Editor:

```text
supabase/migrations/0013_consumer_booking_cancellation.sql
```

Run the SQL **inside the file**, not the filename. Apply it after
`0012_public_beta.sql`.

The migration is additive and does not drop a table, truncate data, or delete
rows. It:

- adds `bookings.consumer_cancelled_at` for a private audit timestamp;
- extends the existing slot-detachment trigger to `cancelled` bookings;
- installs the service-role-only `cancel_consumer_booking` function;
- locks the request, booking, and availability rows before changing them;
- revalidates ownership, status, future time, and the booked slot;
- changes the slot to `available`, the booking to `cancelled`, and the request
  to `cancelled` in the same transaction;
- makes a repeated cancellation safely idempotent.

Execution is revoked from `public`, `anon`, and `authenticated`, then granted
only to `service_role`. The browser cannot call the function directly.

## API contract

```text
POST /api/bookings/cancel
Cookie: aylo_request_history=<opaque encrypted token>
Content-Type: application/json
```

```json
{
  "actionToken": "<opaque ten-minute token>",
  "confirmed": true
}
```

The strict input rejects caller-supplied IDs and extra fields. The route
rechecks beta access, applies the existing booking fair-use limit before
parsing the body, disables shared caching, and returns only a short reference,
`cancelled` status, and whether this call changed the row.

Important responses:

- `400` for invalid input or missing explicit confirmation;
- `403` for expired action tokens or missing browser ownership;
- `403` when the token, browser ownership, or booking no longer matches;
- `409` for a final, past, or changed booking/slot;
- `503` when private persistence, encryption, or the Day 32 migration is
  unavailable.

## Data modes

| Mode | Behavior |
| --- | --- |
| Live Supabase + server secret | Status and confirmed cancellation persist |
| Public-key catalog only | Private bookings and cancellation stay unavailable |
| Local demo | No fake cancellation or provider decision is written |

No new environment variable is required. Day 32 derives a separate
context-bound action key from the existing request-history secret resolution.

## Verification

```bash
npm run test:booking-status
npm test
npm run typecheck
npm run build
```

1. Run `0013_consumer_booking_cancellation.sql` and restart the server.
2. Create a future live booking, open `/bookings`, and select **Cancel booking**.
3. Close the dialog and verify no row or slot changed.
4. Confirm cancellation and verify the booking/request are `cancelled`, the
   slot is `available`, and the booking's `availability_id` is detached.
5. Repeat the same API action and confirm it succeeds without a second change.
6. Accept another future booking from `/leads`, then cancel it from the original
   browser and verify the accepted slot is released.
7. Try a rejected or past booking and confirm the write is refused.
8. Copy only the action token to another browser and confirm it receives `403`.
9. Modify or wait ten minutes for the token and confirm refresh is required.
10. Confirm the dialog and cards remain usable on a narrow mobile viewport.
