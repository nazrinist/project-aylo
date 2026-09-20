# Day 18 — Lead inbox

Day 18 adds `/leads`, a read-only inbox for booking requests. Merchants can
select a business, review status counts, filter the queue, and inspect the
service, appointment, price, received time, and short booking reference.

Accept and reject actions are intentionally not part of this day. They remain
Day 19 work and must re-authorize the operator before every mutation.

## Privacy-minimized lead DTO

The lead data layer selects only these booking fields:

```text
id, booked_for, price, currency, status, created_at, services(name)
```

The full booking ID is reduced to an eight-character display reference before
the response is created. The inbox does not query the `requests` table and does
not load or return:

- `request_id`;
- `availability_id`;
- `user_id`;
- `original_request`;
- customer identity or contact details;
- raw database rows.

The data access module is marked `server-only`. Live responses also use
`Cache-Control: private, no-store`.

## Data modes

| Mode | Configuration | Inbox behavior |
| --- | --- | --- |
| `operations` | Supabase secret key + valid operator token | Live, privacy-minimized booking leads |
| `catalog` | Public Supabase key only | Businesses remain selectable, but private leads stay unavailable |
| `demo` | No Supabase keys | Clearly labeled local sample leads for every demo business |

Demo lead totals are fixtures, not claims about real bookings. Catalog mode
uses em dashes instead of pretending that the private queue contains zero
leads.

## Temporary operator gate

Individual booking records are more sensitive than Day 17 aggregate counts.
Live lead access therefore requires a second server-side value in addition to
`SUPABASE_SECRET_KEY`:

```bash
openssl rand -hex 32
```

Put the generated value in `.env.local` and restart the server:

```env
AYLO_OPERATOR_TOKEN=generated-value-here
```

The `/leads` page asks for that value when live Supabase access is enabled. It
sends the token as a Bearer authorization header, keeps it only in the current
page's React memory, and clears both the token and live response when **Lock
inbox** is selected. It is not written to local storage, session storage, a
cookie, a URL, or the repository.

The server hashes both values and uses a constant-time comparison. Tokens
shorter than 32 characters are treated as unconfigured.

This shared operator token is an alpha safeguard, not full merchant identity
or tenant authorization. A public production deployment still needs real
authentication and business ownership checks before exposing live operations.

## API contract

The default queue contains new leads:

```text
GET /api/leads?status=pending_confirmation
Authorization: Bearer <AYLO_OPERATOR_TOKEN>
```

Supported statuses are:

- `all`;
- `pending_confirmation`;
- `accepted`;
- `rejected`;
- `cancelled`.

Add `businessId=<uuid>` to select a business. Query validation is strict:
invalid UUIDs, invalid statuses, and unsupported parameters return `400`.
Missing or invalid live access returns `401`; missing operator configuration
returns `503`; an unknown business returns `404`.

The API returns exact status counts and at most the newest 50 matching leads.
The UI explicitly reports when the result list is capped.

## Database changes

No new migration is required. Day 18 reads private `bookings` rows created by
the Day 16 atomic booking flow. RLS still exposes no booking policy to public
Supabase clients.

## End-to-end check

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Then verify:

1. Without Supabase keys, `/leads` opens a clearly labeled demo queue.
2. Business and status filters refresh the sample cards.
3. With public Supabase keys only, the page says private leads are unavailable.
4. With the Supabase secret key and operator token, the page first displays the
   unlock form.
5. A wrong token stays locked; the correct token loads live booking leads.
6. **Lock inbox** removes the live response and token from page memory.
7. No customer identity, request text, accept button, or reject button appears.
8. The layout remains usable on a narrow mobile viewport.
