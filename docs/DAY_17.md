# Day 17 — Business dashboard

Day 17 adds `/dashboard`, a read-only merchant overview for one selected
business. It combines profile readiness, the next 30 days of catalog activity,
active services, and upcoming slots without sending request text, user IDs, or
raw booking rows to the browser.

## Dashboard contents

- business selector and manual refresh;
- verified, address, active-service, and open-slot readiness checks;
- active service and open availability totals;
- privacy-safe pending booking and booked slot totals when server-only access is
  available;
- current service catalog and the next eight schedule entries;
- quick links to the existing business, service, and availability screens.

The page is intentionally read-only. Day 18 adds the lead inbox, Day 19 adds
accept/reject actions, Day 20 expands availability management, and Day 21 adds
analytics.

## Data modes

| Mode | Configuration | What the dashboard shows |
| --- | --- | --- |
| `operations` | Supabase URL + `SUPABASE_SECRET_KEY` | Live catalog, all slot states, and aggregate private counts |
| `catalog` | Supabase URL + publishable/anon key | Public businesses, active services, and available slots; private counts are unavailable |
| `demo` | No Supabase keys | Local sample businesses, services, and generated sample slots; private counts are unavailable |

Fallback behavior is explicit: the UI displays its current mode and uses an
em dash for unavailable private metrics. It never fabricates booking totals.

## API and privacy boundary

`GET /api/dashboard` selects the first business. A specific business can be
requested with a UUID:

```text
GET /api/dashboard?businessId=00000000-0000-4000-8000-000000000001
```

The query is strict. Invalid UUIDs and unsupported parameters receive `400`,
and an unknown business receives `404`.

The server returns purpose-built dashboard DTOs rather than database rows. For
private tables it runs `head`/exact-count queries only, so booking records are
not loaded into the response. It does not query or return:

- `requests.original_request`;
- `requests.user_id`;
- request details or customer identity;
- raw booking rows.

`lib/dashboard/data.ts` is marked `server-only`, keeping the secret key and
private queries outside the client bundle.

Aylo does not have merchant authentication yet. Therefore `operations` mode is
an internal alpha/operator preview, not a production authorization boundary.
Do not expose the admin pages or this private aggregate mode publicly until
merchant authentication and per-business authorization are added. Catalog and
demo modes remain honest read-only fallbacks.

## Database changes

No new migration is required. Day 17 reads the tables and statuses established
through `0006_booking_persistence.sql`.

## End-to-end check

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Then open `http://localhost:3000/dashboard` and verify:

1. The page loads in demo mode without environment keys.
2. Selecting a business refreshes its profile, services, and sample slots.
3. Pending bookings and booked slots display as unavailable in demo mode.
4. With public Supabase keys, the badge changes to **Catalog only** and live
   public data appears.
5. With `SUPABASE_SECRET_KEY`, the badge changes to **Live operations** and the
   aggregate private totals appear without customer or request details.
6. The layout remains usable on a narrow mobile viewport.
