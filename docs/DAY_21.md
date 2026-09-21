# Day 21 — Basic analytics

Day 21 adds `/analytics`, a privacy-minimized merchant view of booking demand
and lead decisions. Operators can choose a business and inspect the last 7, 30,
or 90 Baku calendar days without loading customer identity or request text.

## Metrics

The report uses the booking creation time for its reporting window and shows:

- total leads;
- accepted bookings;
- acceptance rate (`accepted / (accepted + rejected)`);
- accepted booking value grouped by currency;
- average response time for accepted and rejected leads;
- pending, accepted, rejected, and cancelled status counts;
- daily lead and accepted-booking trend;
- the top five services by lead volume.

Acceptance rate is unavailable when there are no accepted or rejected leads.
Average response time is unavailable when no valid merchant response timestamps
exist. These values display as an em dash instead of pretending the metric is
zero.

**Accepted booking value is not revenue.** Aylo does not yet track payment or
service completion, so the interface never describes accepted value as money
collected. Different currencies are kept as separate totals and are never added
together.

## Data modes

| Mode | Configuration | Behavior |
| --- | --- | --- |
| `operations` | Supabase URL + secret key + `AYLO_OPERATOR_TOKEN` | Live booking aggregates for the selected business |
| `catalog` | Public Supabase key only | Business selector remains available; private analytics stay hidden |
| `demo` | No Supabase keys | Deterministic sample analytics clearly labeled as demo data |

Demo metrics are generated locally and do not claim to describe real bookings.
Catalog mode never fabricates zero booking performance.

## Privacy and authorization

Live analytics use the same 32+ character `AYLO_OPERATOR_TOKEN` as the lead
inbox and availability manager. Every `GET /api/analytics` request validates the
Bearer token independently. The browser keeps the token only in the current
page's React memory and clears it when **Lock analytics** is selected.

The server-only data layer selects only:

```text
status, price, currency, created_at, merchant_responded_at, service_id, services(name)
```

It does not select or return booking IDs, request IDs, availability IDs, user
IDs, request text, customer identity, or contact details. Booking rows are
paginated on the server, reduced into aggregate DTOs, and never returned to the
browser. API responses use `Cache-Control: private, no-store`.

The shared token remains an internal-alpha safeguard. A public production
deployment still needs individual merchant authentication and per-business
authorization.

## API contract

```text
GET /api/analytics?range=30d&businessId=<uuid>
Authorization: Bearer <AYLO_OPERATOR_TOKEN>
```

Supported ranges are `7d`, `30d`, and `90d`; the default is `30d`. Query
validation is strict. Invalid UUIDs, invalid ranges, and unsupported parameters
receive `400`.

Important responses include:

- `401` for a missing or invalid live operator token;
- `404` for an unknown business;
- `503` when operator access is not configured;
- `503` when the Day 19 response-time prerequisite is missing.

## Database changes

No new migration is required. Day 21 reads the existing `bookings` table and
the `merchant_responded_at` field installed by
`supabase/migrations/0007_lead_decisions.sql`.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Then verify:

1. With no Supabase keys, `/analytics` displays clearly labeled demo metrics.
2. Switching between 7, 30, and 90 days rebuilds the complete daily trend.
3. Changing business updates every metric and service row.
4. With public keys only, the page explains that private analytics are hidden.
5. With the secret key configured, the page requires `AYLO_OPERATOR_TOKEN`.
6. A wrong token stays locked; the correct token loads live aggregates.
7. **Lock analytics** clears the token and private report from page memory.
8. Accepted booking value is labeled as value, not collected revenue.
9. No customer identity, request text, user ID, or booking ID appears in the API
   response.
10. The layout remains usable on a narrow mobile viewport.
