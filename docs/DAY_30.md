# Day 30 — Public beta

Day 30 opens Aylo's consumer journey without an invite code while preserving a
closed-beta rollback. The launch stays deliberately narrow: non-medical beauty
services in Baku, explainable matching, and an explicit review before a booking
request is created.

## What ships

- `AYLO_BETA_MODE=public` opens consumer access and requires a 32+ character
  session secret.
- A random participant ID is encrypted in a seven-day `HttpOnly`,
  `SameSite=Strict` cookie. Public sessions contain no invite fingerprint.
- Public feedback keeps the Day 29 outcome, ease, and optional-note contract.
- Intent, search, booking, feedback, `searchProviders`, and
  `checkAvailability` consume atomic Supabase fair-use counters before request
  bodies are parsed.
- Public navigation contains only consumer history, preferences, and privacy;
  merchant workspaces remain reachable directly and keep their independent
  `AYLO_OPERATOR_TOKEN` authorization.
- `/privacy`, error/404 recovery, crawler boundaries, richer metadata, generic
  health errors, and baseline browser security headers complete the launch
  surface.

## 1. Run the migration

In the Supabase SQL Editor, run:

```text
supabase/migrations/0012_public_beta.sql
```

The migration is additive. It labels existing Day 29 participants as `closed`,
allows public participants without an invite fingerprint, creates a private
rate-limit table, and installs one service-role-only atomic function. It does
not drop a table, truncate data, or delete rows.

## 2. Configure production

Keep the Day 29 secret or generate a new one:

```bash
openssl rand -base64 32
```

Set the production environment values:

```env
AYLO_BETA_MODE=public
AYLO_BETA_SECRET=PASTE_THE_32_PLUS_CHARACTER_SECRET

OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
BOOKING_SIGNING_SECRET=...
REQUEST_HISTORY_SECRET=...
PREFERENCES_SECRET=...
AYLO_OPERATOR_TOKEN=...
```

`AYLO_BETA_INVITE_CODES` is ignored in public mode but should be retained in the
hosting environment for a fast closed-beta rollback. Never prefix server
secrets with `NEXT_PUBLIC_`. Restart or redeploy after changing values.

`AYLO_BETA_MODE=open` is the local-preview mode: it has no gate, participant
session, public feedback persistence, or public rate limits. Do not use it as
the production public-beta setting. A missing or unrecognized mode fails closed
in production instead of silently opening an unprotected launch.

## 3. Fair-use limits

| Action | Limit | Window |
| --- | ---: | ---: |
| Intent extraction | 20 | 10 minutes |
| Provider search | 20 | 10 minutes |
| Booking request | 5 | 10 minutes |
| Feedback | 5 | 60 minutes |
| Direct search tool | 30 | 10 minutes |
| Direct availability tool | 30 | 10 minutes |

Counters belong to the random browser participant ID. Aylo does not store an
IP address or user-agent for application rate limiting. Clearing cookies can
start a new identity, so production hosting should also keep platform-level
traffic and spending controls enabled. Application limits fail closed in
`public` mode when the Supabase secret or Day 30 migration is missing.

## 4. Launch acceptance test

1. Open `/beta` in a private browser window and confirm **Public beta is live**.
2. Open `/` without an invite code and confirm the `aylo_beta_session` cookie is
   `HttpOnly`, `SameSite=Strict`, and `Secure` on HTTPS.
3. Search for: `Bu həftə Ağ Şəhərdə 120 AZN-dən ucuz saç və makiyaj istəyirəm`.
4. Confirm results show hard filters, ranking reasons, price, time, and source.
5. Select an offer and confirm Aylo still requires the explicit review step.
6. Submit public-beta feedback and verify a `beta_feedback` row is created.
7. Open `/privacy`, an unknown URL, and simulate a page error to verify the
   public privacy and recovery surfaces.
8. Confirm the home page does not link merchant dashboard, leads, analytics,
   business CRUD, or availability management.
9. Confirm merchant writes still reject missing or wrong
   `AYLO_OPERATOR_TOKEN` values.
10. Confirm a consumed request window returns `429`, a generic body, and a
    positive `Retry-After` header.

## 5. Monitor without identity data

Participants by launch mode:

```sql
select access_mode, count(*) as browser_participants
from public.beta_participants
group by access_mode
order by access_mode;
```

Feedback outcomes:

```sql
select
  outcome,
  count(*) as responses,
  round(avg(ease_rating), 2) as average_ease
from public.beta_feedback
group by outcome
order by responses desc;
```

Active rate-limit buckets:

```sql
select action, count(*) as sessions, max(request_count) as highest_count
from public.beta_rate_limits
where updated_at >= now() - interval '1 hour'
group by action
order by action;
```

Use private `agent_runs` trace data for failure rate and latency. Do not publish
feedback comments, request text, cookies, participant IDs, or trace IDs.

## 6. Rollback

To pause public entry without reverting code:

```env
AYLO_BETA_MODE=closed
AYLO_BETA_INVITE_CODES=THE_EXISTING_PRIVATE_CODES
```

Keep `AYLO_BETA_SECRET` unchanged and restart or redeploy. Public sessions are
not accepted as closed-beta sessions; testers must enter an active invite code.
Returning to `public` restores open entry. Use `open` only for local preview.

## Verification

```bash
npm run test:public-beta
npm test
npm run typecheck
npm run build
```

The focused suite covers public session encryption and separation, fair-use
policies, pre-body route enforcement, private migration grants, feedback,
consumer/operator navigation separation, generic health errors, recovery UI,
crawler boundaries, and browser security headers.
