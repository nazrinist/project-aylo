# Day 10 — `searchProviders` tool

Day 10 turns provider discovery into a reusable tool with one validated contract.
The normal `/api/search` flow now calls the same executor as the proof endpoint,
so demo data and Supabase follow identical eligibility rules.

## What the tool does

`searchProviders` returns active provider services that satisfy:

- marketplace category;
- every requested service;
- Baku area;
- minimum and maximum budget;
- currency;
- result limit.

It deliberately does **not** inspect appointment slots. Availability remains the
next orchestration step and will become the separate `checkAvailability` tool on
Day 11.

The OpenAI Responses-compatible function definition is exported from
`lib/tools/search-providers-contract.ts`. Zod validates the same input again at
the executor boundary; AI output is never trusted directly.

## Proof endpoint

Start the app and call:

```bash
curl -X POST http://localhost:3000/api/tools/search-providers \
  -H 'Content-Type: application/json' \
  -d '{
    "category": "beauty",
    "services": ["hair", "makeup"],
    "location": "Ağ Şəhər, Bakı",
    "budget_min": null,
    "budget_max": 120,
    "currency": "AZN",
    "limit": 10
  }'
```

Without Supabase credentials the response uses the seed-aligned demo catalog:

```json
{
  "ok": true,
  "source": "demo",
  "providers": [
    {
      "businessName": "Glow Studio",
      "serviceName": "Hair + Makeup",
      "address": "Ağ Şəhər, Bakı",
      "price": 95,
      "currency": "AZN"
    }
  ]
}
```

With `NEXT_PUBLIC_SUPABASE_URL` and a publishable key, the executor reads active
beauty services through the public RLS-protected client and returns
`"source": "supabase"`.

## Search orchestration

The existing `POST /api/search` endpoint now runs these stages:

1. validate the normalized intent;
2. persist the private request when Supabase is configured;
3. execute `searchProviders` for eligible service candidates;
4. read available slots for those candidates;
5. apply time rules and rank up to six results.

Provider selection stays deterministic. OpenAI may choose and fill the tool, but
Zod plus application code enforce the actual constraints.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The tool tests verify its strict function schema, input normalization, invalid
budget rejection, deterministic filters, stable ordering, and limit handling.

No new migration or environment variable is required for Day 10.
