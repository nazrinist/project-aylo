# Project Aylo

> From intent to done.

Project Aylo is an AI action layer that turns a user's natural-language request into a structured intent, finds matching providers, ranks offers and ultimately completes a booking with explicit user confirmation.

## MVP
The first wedge is **beauty services in Baku**.

Example:

> “Tomorrow at 6, find me hair + makeup near White City under 120 AZN.”

Aylo extracts the constraints, searches providers and availability, ranks the best matches, then asks the user to confirm before booking.

## Stack
- Next.js 16.3.3
- React 19.3
- TypeScript
- OpenAI Node SDK
- Supabase / Postgres
- Node.js 24

## Start locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app runs in demo mode with no keys. To enable AI intent extraction, add:

```env
OPENAI_API_KEY=...
```

To switch provider search from demo data to Supabase, also add:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Legacy Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-only
write operations can later use `SUPABASE_SECRET_KEY`; never expose it in browser
code or commit `.env.local`.

Then open `http://localhost:3000`.

## Day 1 proof
`POST /api/intent`

```json
{
  "request": "Sabah axşam Ağ Şəhərdə 100 manatdan ucuz saç və makeup istəyirəm"
}
```

returns a normalized intent object used by the future search engine.

## Day 2 proof

`POST /api/search` accepts the normalized intent and returns ranked provider slots.
The same UI works in two modes:

- `demo`: local provider fixtures, so the complete flow works without credentials;
- `supabase`: real `businesses`, `services`, and `availability` rows.

Run the SQL files in this order inside a Supabase project:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_search_security.sql`
3. `supabase/migrations/0003_api_grants.sql`
4. `supabase/migrations/0004_availability_integrity.sql`
5. `supabase/seed.sql`

See [docs/DAY_2.md](./docs/DAY_2.md) for the data flow and setup checklist.

## Day 3 proof

`GET /api/health` verifies the database connection and returns counts for
businesses, services, and available slots. The home page shows **Supabase
connected** when the hosted database is ready.

Follow [docs/DAY_3.md](./docs/DAY_3.md) to create the project, run the SQL, add
the current publishable key, and verify the live search flow.

## Day 4 proof

`/businesses` is the first Aylo Business admin screen. It lists providers and
supports create, update, verification, and deletion through validated server
APIs. Write operations require `SUPABASE_SECRET_KEY`; the secret never crosses
into browser code.

See [docs/DAY_4.md](./docs/DAY_4.md) for secure local setup and the CRUD test.

## Day 5 proof

`/services` manages each provider's service name, description, price, duration,
and active status. The API supports listing, filtering, creating, updating, and
deleting services with the same server-only write protection.

See [docs/DAY_5.md](./docs/DAY_5.md) for validation rules and the end-to-end test.

## Day 6 proof

`/availability` manages bookable times for each service. Slots are entered in
Baku time, public reads respect RLS, and server-side writes reject invalid or
overlapping intervals. PostgreSQL also enforces the overlap rule so concurrent
requests cannot create conflicting slots.

Run `supabase/migrations/0004_availability_integrity.sql`, then follow
[docs/DAY_6.md](./docs/DAY_6.md) for the CRUD and overlap test.

## Product rules
1. AI interprets intent; deterministic code handles filtering and permissions.
2. No irreversible action without explicit user confirmation.
3. V1 stays narrow: beauty first, universal agent later.
4. Optimize for **completed intents**, not chat messages.

See [ROADMAP.md](./ROADMAP.md) and [docs/PRODUCT.md](./docs/PRODUCT.md).
