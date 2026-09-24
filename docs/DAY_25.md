# Day 25 — Permission and safety checks

Day 25 closes two authorization and policy gaps: catalog mutations now require
explicit operator access, and every consumer request crosses the same
deterministic safety boundary before AI or provider search runs.

## Operator permissions

Public catalog reads remain available through `GET /api/businesses` and
`GET /api/services`. These mutations now require both server configuration and
a valid operator bearer token:

- `POST /api/businesses`;
- `PATCH` and `DELETE /api/businesses/:id`;
- `POST /api/services`;
- `PATCH` and `DELETE /api/services/:id`.

The server checks `AYLO_OPERATOR_TOKEN` with the existing constant-time digest
comparison before parsing the request body or touching the database. Missing or
invalid access returns a private, non-cacheable `401`; missing server
configuration returns `503`.

The Businesses and Services screens accept the token in a password field and
send it only in the `Authorization` header. It remains in React memory for the
current page and is never written to local storage, session storage, or a
JavaScript-readable cookie.

## Request safety

`POST /api/intent` checks the raw request before calling the model.
`POST /api/search` independently checks `original_request`, so a caller cannot
bypass the boundary by submitting a structured intent directly.

Aylo V1 allows ordinary non-medical beauty services. It refuses:

- invasive or medical procedures that require a qualified licensed specialist;
- attempts to override system instructions or extract prompts, API keys,
  environment variables, or secrets.

The checks are deterministic and return stable safe codes. Raw exception or
database messages are no longer returned by the intent and search endpoints.
The same safe code is recorded by Day 24 observability without storing request
text.

This is a narrow product boundary, not medical triage or a universal content
moderation system. Unsupported ordinary categories still follow Aylo's normal
`unknown` category behavior.

## Verification

1. Open `/businesses` or `/services` without a token and confirm the catalog is
   readable while mutation buttons stay disabled.
2. Enter the configured `AYLO_OPERATOR_TOKEN` and confirm a write succeeds.
3. Send an ordinary hair or makeup request and confirm normal search behavior.
4. Send an invasive procedure request and confirm the specialist boundary is
   returned before search.
5. Run `npm test`, `npm run typecheck`, and `npm run build`.

No Supabase migration is required for Day 25.
