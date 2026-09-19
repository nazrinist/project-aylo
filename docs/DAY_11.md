# Day 11 — `checkAvailability` tool

Day 11 separates appointment-slot lookup from provider discovery. The normal
search flow now executes two reusable tools in sequence:

1. `searchProviders` finds eligible provider services;
2. `checkAvailability` finds open slots for those service IDs.

Both tools use strict OpenAI Responses-compatible function schemas and matching
Zod validation at the executor boundary.

## What the tool checks

`checkAvailability` accepts:

- one or more service UUIDs returned by `searchProviders`;
- a valid `YYYY-MM-DD` date;
- an optional `HH:mm` time window;
- a result limit.

All times are interpreted in `Asia/Baku`. If only `time_from` is present, it is
treated as a preferred time with the existing ±60-minute tolerance. Explicit
and overnight windows are also supported.

The tool returns only slots with `available` status. Demo mode uses stable slots
at 10:00, 14:00, and 18:00; Supabase mode reads the public RLS-protected
`availability` table.

## Proof endpoint

Start the app and call:

```bash
curl -X POST http://localhost:3000/api/tools/check-availability \
  -H 'Content-Type: application/json' \
  -d '{
    "service_ids": [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000009",
      "10000000-0000-4000-8000-000000000013"
    ],
    "date": "2026-09-20",
    "time_from": "18:00",
    "time_to": null,
    "limit": 20
  }'
```

Demo mode returns one 18:00 slot for each requested service:

```json
{
  "ok": true,
  "source": "demo",
  "slots": [
    {
      "serviceId": "10000000-0000-4000-8000-000000000001",
      "startTime": "2026-09-20T18:00:00+04:00",
      "endTime": "2026-09-20T19:30:00+04:00"
    }
  ]
}
```

Use the `serviceId` values from
`POST /api/tools/search-providers` when testing a different request.

## Search orchestration

`POST /api/search` now performs this sequence:

1. validate and persist the normalized intent;
2. execute `searchProviders`;
3. pass its service IDs to `checkAvailability`;
4. join provider metadata with returned slots;
5. apply defensive filters and rank up to six results.

Demo and Supabase now share this exact orchestration path. Availability lookup
is no longer embedded inside provider discovery.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The Day 11 tests cover strict tool parameters, invalid dates/times/UUIDs,
duplicate service IDs, single-time tolerance, explicit and overnight windows,
stable ordering, and result limits.

No new migration or environment variable is required for Day 11.
