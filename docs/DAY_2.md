# Day 2 — Supabase + provider search

## What works now

The UI performs one user action but two API calls:

1. `/api/intent` converts natural language to a typed `Intent`.
2. `/api/search` filters available services and ranks the best slots.

The search response has a stable shape in both demo and Supabase mode. This is
important: replacing test data with the database does not require changing the
React components.

## Why each layer exists

- `app/page.tsx`: owns browser state and renders result cards.
- `app/api/search/route.ts`: validates untrusted request JSON at the server boundary.
- `lib/search/providers.ts`: orchestrates provider, availability, and ranking stages.
- `lib/search/shared.ts`: deterministic matching and time functions.
- `lib/search/ranking.ts`: explainable scoring and stable result ordering.
- `lib/supabase/server.ts`: keeps privileged database access on the server.
- `types/search.ts`: shared contract between API and UI.

The language model interprets intent. Normal TypeScript code performs filtering
and ranking, which makes the result cheaper, testable, and predictable.

## Connect a Supabase project

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `0001_initial_schema.sql`.
4. Run `0002_search_security.sql`.
5. Run `seed.sql`.
6. Copy the project URL and keys into `.env.local`.
7. Restart `npm run dev`.

The result badge changes from `Demo data` to `Live database` when the connection
is configured.

## Security choice

Provider profiles, active services, and open slots are publicly readable.
Requests and bookings have no public write policy yet. Only server-side code
using the service-role key can access them. User-specific policies arrive with
authentication in a later milestone.

## Test sentence

```text
Sabah 18:00-da Ağ Şəhərdə 120 AZN-dən ucuz saç və makiyaj istəyirəm.
```

Expected behavior: structured intent appears, followed by ranked provider cards.
