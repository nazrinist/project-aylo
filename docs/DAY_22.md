# Day 22 — Request history

Day 22 adds `/history`, a private list of the successful live searches created
by the current browser. It shows the original request, normalized services,
location, schedule, budget, lifecycle status, result count, and creation time.

## Ownership model

Aylo does not have customer accounts yet, so request history must not use an
untrusted request ID or expose every row in the private `requests` table.
Instead, a successful `/api/search` response adds that request ID to an
authenticated, encrypted browser token:

- AES-256-GCM with a versioned Aylo context;
- an `HttpOnly`, `SameSite=Lax` cookie that is `Secure` in production;
- at most the 20 newest unique request IDs;
- a 30-day expiry after the latest successful saved search;
- malformed, expired, or modified tokens authorize no rows.

`GET /api/history` decrypts the cookie on the server and queries only those
authorized IDs. It never accepts request IDs from the caller. Full UUIDs and
`user_id` are excluded from the response.

This is a browser-bound alpha ownership model, not account authentication.
Another browser cannot see the history, and Aylo does not infer identity from
IP address or device fingerprinting.

## Data modes

| Mode | Behavior |
| --- | --- |
| Supabase URL + server secret | Live browser-bound request history |
| Public Supabase key only | Catalog works, private history stays unavailable |
| No Supabase keys | Demo search works, private history stays unavailable |

`REQUEST_HISTORY_SECRET` is an optional 32+ character override. Without it,
Aylo derives a separate context-bound encryption key from the existing
`BOOKING_SIGNING_SECRET` or Supabase server secret. All candidates remain
server-only.

## API contract

```text
GET /api/history
Cookie: aylo_request_history=<opaque encrypted token>
```

Responses use `Cache-Control: private, no-store` and `Vary: Cookie`.
Unsupported query parameters receive `400`.

```text
DELETE /api/history
```

This expires only the browser's history cookie after explicit confirmation. It
does not delete database rows that may be referenced by bookings or audit data.

## Database changes

No new migration is required. Day 22 reads the private `requests` fields added
by `supabase/migrations/0005_request_persistence.sql`.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

1. Open `/history`; an existing browser with no Day 22 searches starts empty.
2. Submit a complete request while live Supabase persistence is active.
3. Open `/history`; the new request appears with its normalized facts.
4. Submit more searches; newest requests appear first and the list stays capped
   at 20 references.
5. Corrupt the cookie; the API returns an empty list, not other users' rows.
6. Confirm the response contains neither `user_id` nor a full request UUID.
7. Select **Forget this browser** and verify the list clears while the database
   row remains intact.
8. Verify honest unavailable states in public-key-only and demo modes.
9. Confirm the layout remains usable on a narrow mobile viewport.
