# Day 24 — Observability and agent runs

Day 24 adds privacy-safe operational traces for Aylo's intent extraction and
provider search paths. It answers three production questions without storing
user content: what ran, whether it succeeded, and how long it took.

## Apply the migration

Run the full contents of:

```text
supabase/migrations/0009_agent_run_observability.sql
```

Run the SQL statements themselves in Supabase SQL Editor, not the filename.
The migration is additive: it keeps the existing `agent_runs` table and adds
trace, operation, source, token-count, and safe error-code fields plus indexes
and validation constraints.

## Runtime behavior

- `POST /api/intent` records `intent_extraction`.
- `POST /api/search` records `provider_search` and links it to the private
  request row when persistence is available.
- Both success and failure paths receive a UUID trace ID.
- Responses expose the ID through `X-Aylo-Trace-Id` and duration through the
  standard `Server-Timing` header.
- Observability writes are best-effort: a logging outage never breaks search.
- Demo mode works without Supabase; telemetry is simply marked disabled.

Open browser DevTools → Network, select an intent or search request, and inspect
the response headers to copy its trace ID. In Supabase, operators can correlate
that value with the private `agent_runs.trace_id` row.

## Privacy boundary

`agent_runs` remains inaccessible to `anon` and `authenticated` roles. A row
may contain operation, source, model name, success/failure status, latency,
token counts, a stable error category, and an optional private request foreign
key. It never contains:

- prompt or original request text;
- parsed intent or model output;
- provider/search results;
- cookies, authorization headers, or secrets;
- raw exception messages.

`cost_usd` remains `null` until Aylo has a versioned server-side pricing table;
guessing cost from changing model prices would create misleading analytics.

## Verification

After the migration and server restart:

1. Submit a search from the home page.
2. Copy `X-Aylo-Trace-Id` from `/api/intent` and `/api/search` responses.
3. Confirm matching rows exist in the Supabase `agent_runs` table.
4. Confirm no request text or response payload is present in either row.
5. Run `npm test`, `npm run typecheck`, and `npm run build`.
