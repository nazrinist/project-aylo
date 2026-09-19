# Day 16 — Booking persistence

Day 16 turns an explicitly confirmed live offer into a private booking request.
The provider has not accepted it yet: the initial status is
`pending_confirmation`, which the merchant workflow can handle on Days 18–19.

## Write path

1. A successful Supabase search saves its private request and marks it
   `searched`.
2. `/api/search` signs each exact live offer with an HMAC token bound to the
   request, availability slot, business, service, time, price, and currency.
3. The user reviews those details and explicitly checks the acknowledgement.
4. `POST /api/bookings` strictly validates the payload and verifies the token.
5. `create_booking_from_confirmation` locks the request and availability rows,
   then rechecks the slot, active service, time, price, and currency.
6. One transaction inserts the booking, marks the slot `booked`, and marks the
   request `completed`.

Repeating the same confirmed request and slot is idempotent: the existing
booking is returned. A different booking for the same request or slot is
rejected by both row locks and unique indexes.

## Security boundary

- `SUPABASE_SECRET_KEY` and `BOOKING_SIGNING_SECRET` are server-only.
- The booking RPC is a `security definer` function with a fixed safe
  `search_path`.
- Execute permission is revoked from `public`, `anon`, and `authenticated` and
  granted only to `service_role`.
- Bookings remain behind RLS with no public table policy.
- Browser values are never trusted by themselves; the signature and current
  database rows must agree.
- The response says **Pending provider confirmation** rather than claiming the
  provider accepted or was contacted.

`BOOKING_SIGNING_SECRET` is optional. If it is empty, the server uses the
Supabase secret/service-role key as the HMAC key. A separate random secret is
recommended for deployed environments:

```bash
openssl rand -hex 32
```

Put the generated value only in `.env.local`. Rotating it invalidates existing
signed search offers; users can simply run the search again.

## Database upgrade

In Supabase SQL Editor, open this local file and run its full contents:

```text
supabase/migrations/0006_booking_persistence.sql
```

Run the SQL inside the file, not the filename itself. The migration adds the
availability reference, currency, confirmation timestamp, uniqueness rules,
and atomic booking RPC. It is safe to rerun.

## End-to-end check

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Then:

1. Create a future available slot in `/availability`.
2. Search for that live service and open **Book appointment**.
3. Check the acknowledgement and select **Confirm & create booking**.
4. Confirm the UI shows **Booking request created**, **Pending provider
   confirmation**, and a reference.
5. In Supabase, verify one `bookings` row with status `pending_confirmation`,
   the availability row with status `booked`, and the request with status
   `completed`.
6. Retry the same confirmation and verify no duplicate row is created.

Without live Supabase request persistence, the same UI stays in demo mode,
labels the result as local, and does not contact the booking API.
