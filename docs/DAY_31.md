# Day 31 — Consumer booking status

Day 31 closes the first post-booking feedback loop. `/bookings` shows the
current provider decision for booking requests created from the same browser:
waiting, accepted, not accepted, cancelled, or safely unknown.

## Ownership model

Aylo still has no customer accounts, so the browser must not send a booking,
request, business, service, or availability ID to select rows. `GET
/api/bookings` instead reuses the encrypted Day 22 request-history cookie:

- the server decrypts the opaque `aylo_request_history` token;
- only bookings whose `request_id` belongs to those authenticated references
  are queried;
- query parameters are rejected rather than treated as ownership claims;
- a modified, expired, missing, or forgotten token authorizes zero rows;
- responses use `Cache-Control: private, no-store` and `Vary: Cookie`.

This is browser-bound access, not customer authentication. A future account
system can replace it without weakening today's boundary.

## Minimal response

The browser receives only display data:

- an eight-character booking reference;
- provider, service, location, appointment, duration, price, and currency;
- booking status, creation time, and optional provider-response time.

Full booking, request, business, service, and availability IDs never enter the
response. Request text and user identity are neither selected nor returned.

## Product behavior

- The home page and persisted-booking success dialog link to **My bookings**.
- The page refreshes on demand and once per minute while it remains open.
- Pending, accepted, rejected, cancelled, and unknown states have distinct,
  accessible text instead of relying on color alone.
- Demo and public-catalog modes show an honest unavailable state; they do not
  fabricate provider decisions.
- Forgetting request history also removes browser access to My bookings. It
  does not delete private database records.
- `/bookings` is excluded from crawler-visible routes.

## Database and configuration

No new migration or environment variable is required. Day 31 reads the
`bookings` relationships and `merchant_responded_at` field already installed by
the Day 16 and Day 19 migrations. Live status requires the existing server-side
Supabase key and the same history-secret resolution used by Day 22.

## Verification

```bash
npm run test:booking-status
npm test
npm run typecheck
npm run build
```

1. Create a live booking and select **Track booking** in the success dialog.
2. Confirm it appears as **Waiting for provider** with only a short reference.
3. In `/leads`, accept or reject that booking, then refresh `/bookings` and
   confirm the new state and provider-response time appear.
4. Try a booking or request ID in the query string; confirm the API returns
   `400` without loading a row.
5. Open a different browser or remove the history cookie; confirm the list is
   empty rather than exposing the booking.
6. Use **Forget this browser** in request history and confirm both private
   browser lists disappear while their database rows remain.
7. Verify the unavailable message in demo and public-catalog modes.
8. Confirm the page remains usable on a narrow mobile viewport.
