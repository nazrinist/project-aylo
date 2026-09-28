# Day 29 — Closed beta

Day 29 turns the working MVP into an invitation-only product test. The goal is
to recruit 50 real testers—not only friends or family—and ask each person to try
one concrete job:

> Use Aylo to find a beauty appointment in Baku that you could book this week.

## What ships

- `/beta` is the invite-code entry screen.
- `proxy.ts` redirects protected pages and returns a private `401` for protected
  APIs when access is missing.
- Intent, search, booking, history, preferences, and tool endpoints re-check
  beta access inside their own handlers before parsing input.
- A valid code creates a seven-day AES-256-GCM encrypted `HttpOnly` cookie.
- Search results expose a small structured feedback form to authenticated beta
  testers.
- Supabase stores a pseudonymous browser participant, outcome, ease rating, and
  optional comment.

The beta gate is separate from merchant authorization. Business writes,
availability management, leads, and analytics still require
`AYLO_OPERATOR_TOKEN` where applicable.

## 1. Run the migration

In the Supabase SQL Editor, run the contents of:

```text
supabase/migrations/0011_closed_beta.sql
```

The migration only creates private beta tables, indexes, RLS settings, and
grants. It does not drop, truncate, or delete existing data.

## 2. Create secrets and invite codes

Generate a dedicated cookie secret:

```bash
openssl rand -base64 32
```

Generate a different invite code for each tester or small cohort:

```bash
openssl rand -hex 16
```

Add the values to `.env.local`, never to GitHub:

```env
AYLO_BETA_MODE=closed
AYLO_BETA_SECRET=PASTE_THE_32_PLUS_CHARACTER_SECRET
AYLO_BETA_INVITE_CODES=FIRST_16_PLUS_CHARACTER_CODE,SECOND_CODE
```

Aylo accepts at most 100 unique comma-separated codes, each 16–128 characters.
Removing a code invalidates sessions issued by that code. Rotating
`AYLO_BETA_SECRET` invalidates every active beta session.

`SUPABASE_SECRET_KEY` must also be configured for participant counting and
feedback persistence. Restart the server after changing environment values:

```bash
npm run dev
```

`AYLO_BETA_MODE=open` disables beta sessions and the gate for local development.
Day 30 uses the explicit `public` mode, which removes invite entry but still
requires `AYLO_BETA_SECRET` for encrypted anonymous sessions. A closed mode
with a missing secret or code fails closed.

## 3. Acceptance test

1. Open the app in a private browser window.
2. Confirm `/` redirects to `/beta`.
3. Confirm a wrong code is rejected without revealing configuration details.
4. Enter a valid invite code and confirm `/` loads.
5. Complete a search, submit the closed-beta feedback card, and confirm success.
6. Return to `/beta`, choose **Leave beta**, and confirm `/` is gated again.
7. Verify that operator-protected writes still require `AYLO_OPERATOR_TOKEN`.

The invite code is never saved to `localStorage`, `sessionStorage`, or a
JavaScript-readable cookie.

## 4. Monitor the beta

Participant count:

```sql
select count(*) as beta_browser_participants
from public.beta_participants;
```

Outcome and ease summary:

```sql
select
  outcome,
  count(*) as responses,
  round(avg(ease_rating), 2) as average_ease
from public.beta_feedback
group by outcome
order by responses desc;
```

The participant count measures browser sessions, not verified human identity.
Use the invite list to manage the 50-person outreach target and the database to
measure product usage. Do not export optional comments into public documents.

## Privacy boundary

The Day 29 beta tables do not contain a tester's name, email, phone number, IP
address, user-agent, or full search request. The UI asks testers not to put
contact, health, or payment information in optional comments. Both tables have
RLS enabled and deny `anon` and `authenticated` roles.

## Verification

```bash
npm run test:beta
npm test
npm run typecheck
npm run build
```

The focused suite covers encryption, expiry, tamper detection, strict inputs,
constant-time invite checks, proxy/API enforcement, browser-storage rules,
private tables, and feedback data minimization.
