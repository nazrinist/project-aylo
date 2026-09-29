# Day 3 — Connect the real Supabase database

Day 2 made the frontend and search API work with demo data. Day 3 connects the
same code to a hosted Postgres database without changing the result-card UI.

## 1. Create the project

1. Sign in at `https://supabase.com/dashboard`.
2. Choose **New project**.
3. Name it `project-aylo` and select a nearby region.
4. Wait until the project is ready.

## 2. Create the schema and sample catalog

Open **SQL Editor** in the Supabase dashboard. Run these files in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_search_security.sql`
3. `supabase/migrations/0003_api_grants.sql`
4. `supabase/migrations/0004_availability_integrity.sql`
5. `supabase/migrations/0005_request_persistence.sql`
6. `supabase/migrations/0006_booking_persistence.sql`
7. `supabase/migrations/0007_lead_decisions.sql`
8. `supabase/migrations/0008_availability_management.sql`
9. `supabase/migrations/0009_agent_run_observability.sql`
10. `supabase/migrations/0010_provider_provenance.sql`
11. `supabase/migrations/0011_closed_beta.sql`
12. `supabase/migrations/0012_public_beta.sql`
13. `supabase/migrations/0013_consumer_booking_cancellation.sql`
14. `supabase/migrations/0014_consumer_booking_reschedule.sql`
15. `supabase/seed.sql`

The seed is safe to run again. It uses fixed IDs, ignores duplicate
availability slots, and does not overwrite provider candidates already under
review.

## 3. Add the public connection values

Open the project's **Connect** dialog. Copy the project URL and publishable key.
Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

The publishable key is allowed in a browser and can only access rows permitted
by Row Level Security. Do not put a secret key in a `NEXT_PUBLIC_` variable.

Legacy projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead. Aylo supports
both formats.

## 4. Restart and verify

Stop the current dev server with `Ctrl + C`, then run:

```bash
npm run dev
```

Open `http://localhost:3000`. The top-right indicator should change from
**Demo database** to **Supabase connected** and show catalog counts.

You can also open `http://localhost:3000/api/health`. A ready database returns:

```json
{
  "status": "live",
  "database": "connected",
  "counts": {
    "businesses": 52,
    "services": 13,
    "availableSlots": 546
  }
}
```

The number of open slots can grow if the seed is rerun on a later date.

## What changed technically

- `/api/health` checks the real database without exposing keys.
- The UI displays database mode and live catalog counts.
- The server accepts current publishable/secret keys and legacy anon/service-role keys.
- Explicit Postgres grants and RLS policies expose only provider catalog data.
- Requests, offers, bookings, and agent logs remain private.

## Day 3 acceptance test

Search for:

```text
Sabah 18:00-da Ağ Şəhərdə 120 AZN-dən ucuz saç və makiyaj istəyirəm.
```

The results badge must say **Live database**, not **Demo data**.
