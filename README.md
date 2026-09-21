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
- Node.js 20.9+

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
write operations use `SUPABASE_SECRET_KEY` (or the legacy
`SUPABASE_SERVICE_ROLE_KEY`); never expose either key in browser code or commit
`.env.local`.

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
5. `supabase/migrations/0005_request_persistence.sql`
6. `supabase/migrations/0006_booking_persistence.sql`
7. `supabase/migrations/0007_lead_decisions.sql`
8. `supabase/migrations/0008_availability_management.sql`
9. `supabase/seed.sql`

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
requests cannot create conflicting slots. Day 20 additionally protects every
write with `AYLO_OPERATOR_TOKEN` and an atomic management function.

Run `supabase/migrations/0004_availability_integrity.sql`, then follow
[docs/DAY_6.md](./docs/DAY_6.md) for the CRUD and overlap test.

## Day 7 proof

Provider eligibility now uses the same deterministic rules in demo and Supabase
mode. Every requested service, location, Baku date/time window, exact budget,
and currency constraint must match before ranking begins. The UI shows the
applied filters, and stable tie-breakers keep repeated searches predictable.

Run `npm test` and see [docs/DAY_7.md](./docs/DAY_7.md) for the complete filter
contract.

## Day 8 proof

Every validated search can now create a private `requests` row before provider
search begins. Successful searches record `searched_at` and `result_count`;
failed searches keep a visible lifecycle status for future recovery. The UI
shows whether persistence succeeded without exposing the private row.

Run `supabase/migrations/0005_request_persistence.sql`, then follow
[docs/DAY_8.md](./docs/DAY_8.md) for the end-to-end check.

## Day 9 proof

Incomplete requests no longer trigger a weak search. Aylo deterministically
checks for a service, Baku area, and date, then asks one focused follow-up at a
time. Answers are combined with the original request; search and persistence
start only when the required intent is complete.

See [docs/DAY_9.md](./docs/DAY_9.md) for the conversation test.

## Day 10 proof

Provider discovery is now the reusable `searchProviders` tool. It has a strict
OpenAI function schema, a matching Zod boundary, deterministic demo/Supabase
execution, and a direct `POST /api/tools/search-providers` proof endpoint. The
main `/api/search` flow uses this executor before it checks slots and ranks
results.

See [docs/DAY_10.md](./docs/DAY_10.md) for the request payload and verification
steps. No new database migration is required.

## Day 11 proof

Availability lookup is now the separate `checkAvailability` tool with a strict
OpenAI/Zod contract and a direct `POST /api/tools/check-availability` proof
endpoint. The main search flow executes `searchProviders` first, passes its
service IDs into `checkAvailability`, then joins and ranks the available offers.

See [docs/DAY_11.md](./docs/DAY_11.md) for the payload, time-window rules, and
end-to-end verification. No new database migration is required.

## Day 12 proof

Eligible offers now pass through an explainable 100-point ranking engine. The
API returns ranking version `v1`, its factor weights, each result's score
breakdown, and concise reasons while preserving deterministic tie-breakers.

See [docs/DAY_12.md](./docs/DAY_12.md) for the scoring formula and example
response. No new database migration is required.

## Day 13 proof

Ranked offers now render as responsive, accessible result cards with best-match
and verified badges, clear price/time/duration facts, match reasons, and an
expandable six-factor score breakdown. The cards use the ranking weights
returned by the API rather than duplicating scoring rules in the browser.

See [docs/DAY_13.md](./docs/DAY_13.md) for the card hierarchy and accessibility
checks. No new database migration is required.

## Day 14 proof

Users can now select up to three ranked offers and compare them side by side.
The accessible comparison table covers price, Baku availability, duration,
rating, verified status, service, location, and all six ranking factors. It
also marks tied winners instead of silently choosing only one provider.

See [docs/DAY_14.md](./docs/DAY_14.md) for the interaction rules and automated
checks. No new database migration is required.

## Day 15 proof

Day 15 established an explicit review before any booking write. The user checks
provider, service, Baku time, duration, price, and location, then enables the
confirmation action with a separate acknowledgement. Demo confirmations remain
in the current browser session; eligible live confirmations continue through
the Day 16 server-validation path.

See [docs/DAY_15.md](./docs/DAY_15.md) for the draft contract, accessibility
behavior, and Day 16 server-validation boundary. No new database migration is
required.

## Day 16 proof

Explicitly confirmed live offers now create private `bookings` rows through a
strict server API and one atomic PostgreSQL function. The server verifies an
HMAC-signed offer, locks the request and slot, rechecks the service, time,
price, and currency, then creates one pending booking while marking the slot
`booked` and request `completed`. Safe retries return the same booking.

Run `supabase/migrations/0006_booking_persistence.sql`, then follow
[docs/DAY_16.md](./docs/DAY_16.md) for setup, security boundaries, and the
end-to-end test. Demo searches still use an honest browser-only confirmation.

## Day 17 proof

`/dashboard` is the first read-only merchant overview. A business can inspect
profile readiness, active services, open availability, and upcoming slots for
the next 30 days. Server-only Supabase access adds aggregate pending-booking and
booked-slot counts without exposing request text, user identity, or raw booking
rows. Public catalog and local demo modes mark those private metrics as
unavailable instead of inventing data.

See [docs/DAY_17.md](./docs/DAY_17.md) for the three data modes, API contract,
privacy boundary, and end-to-end checklist. No new database migration is
required.

## Day 18 proof

`/leads` is a read-only merchant inbox for confirmed booking requests. It
supports business and status filters, exact queue counts, a 50-lead display
limit, honest demo/catalog fallbacks, and a responsive triage view. Live rows
are reduced to service, appointment, price, status, received time, and a short
reference; the requests table and customer identity are never loaded.

Live access requires both the Supabase secret key and a 32+ character
`AYLO_OPERATOR_TOKEN`. The token is checked with a constant-time comparison and
is held only in the current page's memory. Day 19 builds the confirmed
accept/reject flow on this read-only foundation.

See [docs/DAY_18.md](./docs/DAY_18.md) for setup, privacy boundaries, API
responses, and the end-to-end checklist. No new database migration is required.

## Day 19 proof

Pending leads now expose **Accept** and **Reject** controls behind a separate
final-confirmation dialog. Every live mutation re-checks the operator Bearer
token and uses a short-lived encrypted action token instead of exposing a full
booking ID. Demo decisions stay in page memory and are clearly labeled as
non-persistent; catalog mode still cannot mutate private bookings.

The `decide_booking_lead` SQL function locks the booking and appointment slot
in one transaction. Acceptance keeps the slot booked; rejection releases a
future slot, records `merchant_responded_at`, rejects invalid transitions, and
makes same-decision retries idempotent.

Run `supabase/migrations/0007_lead_decisions.sql`, then follow
[docs/DAY_19.md](./docs/DAY_19.md) for the transition rules, API contract,
security boundary, and end-to-end checklist.

## Day 20 proof

`/availability` is now a seven-day merchant schedule covering available, held,
booked, and blocked slots. Operators can create and edit future free slots, or
explicitly confirm block, reopen, and delete actions. Held and booked times are
read-only because the booking flow owns them.

Live reads and every write re-check the same in-memory `AYLO_OPERATOR_TOKEN`
used by the lead inbox. The `manage_availability_slot` database function locks
the target row, validates business and service ownership, rejects overlaps and
past changes, and applies one atomic mutation. Demo mode simulates changes in
page memory; catalog mode remains honestly read-only.

Run `supabase/migrations/0008_availability_management.sql`, then follow
[docs/DAY_20.md](./docs/DAY_20.md) for the status rules, API contract, security
boundary, and end-to-end checklist.

## Day 21 proof

`/analytics` adds operator-protected 7, 30, and 90-day reporting for each
business. It shows lead volume, decision mix, acceptance rate, accepted booking
value, average merchant response time, a daily trend, and top-service
performance. Accepted value is explicitly not presented as collected revenue
because Aylo does not yet track payment or service completion.

Live reads validate `AYLO_OPERATOR_TOKEN` on every request and reduce paginated
booking rows to aggregate DTOs on the server. Booking IDs, request IDs, user
IDs, request text, and customer identity never enter the response. Demo mode
uses clearly labeled sample metrics, while catalog mode keeps private analytics
unavailable instead of inventing zeros.

No new database migration is required. Follow
[docs/DAY_21.md](./docs/DAY_21.md) for metric definitions, data modes, privacy
boundaries, API behavior, and the end-to-end checklist.

## Product rules
1. AI interprets intent; deterministic code handles filtering and permissions.
2. No irreversible action without explicit user confirmation.
3. V1 stays narrow: beauty first, universal agent later.
4. Optimize for **completed intents**, not chat messages.

See [ROADMAP.md](./ROADMAP.md) and [docs/PRODUCT.md](./docs/PRODUCT.md).
