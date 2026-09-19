# Day 8 — Request persistence

Day 8 stores each normalized search request in the private `requests` table.
This creates the durable request record that later offers, bookings, history,
and agent runs can reference.

## Lifecycle

1. `/api/intent` extracts and validates the structured intent.
2. `/api/search` creates a private request row with status `new`.
3. Deterministic provider search runs normally.
4. The row changes to `searched` and records `result_count` and `searched_at`.
5. If search throws after the row is created, its status changes to `failed`.

The saved row includes the original request, category, services, location,
budget, currency, requested date, and time window.

## Privacy

The `requests` table has RLS enabled and no public read or write policy. The
migration also explicitly revokes access from `anon` and `authenticated`.
Persistence uses `SUPABASE_SECRET_KEY` only inside the server route.

The browser receives only the generated request ID and persistence status. It
does not receive private request rows.

## Database upgrade

Run the full contents of this file in the Supabase SQL Editor:

```text
supabase/migrations/0005_request_persistence.sql
```

Run the SQL inside the file, not the filename itself.

## Test

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Submit a search. The UI should show **Request saved privately**. In Supabase,
open Table Editor → `requests` and verify that the row has status `searched`.

If the app is running without a Supabase secret key, search continues in demo
mode and the UI reports that request history is off.
