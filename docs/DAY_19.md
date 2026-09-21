# Day 19 — Accept or reject a lead

Day 19 turns the privacy-minimized lead inbox into a controlled decision queue.
Pending leads have **Accept** and **Reject** actions, but neither button writes
immediately. A separate dialog explains the effect and requires an explicit
final confirmation first.

## Decision rules

| Current status | Requested decision | Result |
| --- | --- | --- |
| `pending_confirmation` | `accepted` | Booking becomes accepted; slot stays `booked` |
| `pending_confirmation` | `rejected` | Booking becomes rejected; a future slot becomes reusable and `available` |
| `accepted` | `accepted` | Safe retry; no second transition |
| `rejected` | `rejected` | Safe retry; no second transition |
| Any final status | Different decision | `409 LEAD_ALREADY_DECIDED` |

Rejecting a lead whose appointment is already in the past marks its slot
`blocked` instead of advertising an unusable time. A past pending lead cannot be
accepted. Cancellation remains outside the Day 19 merchant action contract.
Day 20 detaches a rejected historical booking from its released availability
row so the same future slot can safely receive a new booking.

## Atomic database mutation

Run the full contents of this migration in Supabase SQL Editor:

```text
supabase/migrations/0007_lead_decisions.sql
```

Run the SQL **inside the file**, not the filename itself. The migration is safe
to rerun. It adds `merchant_responded_at`, a queue index, and the
`decide_booking_lead` function.

The function:

1. requires explicit operator confirmation;
2. accepts only `accepted` or `rejected`;
3. locks the selected booking row;
4. verifies the business and current status;
5. locks and revalidates the linked availability row;
6. updates the booking and, for rejection, the slot in the same transaction;
7. returns only the final status, response time, and whether a transition was
   newly applied.

Execution is revoked from `public`, `anon`, and `authenticated`, then granted
only to `service_role`. No public RLS policy is added for bookings.

## Authorization and action tokens

Live mutations require both server-side Supabase admin configuration and the
same 32+ character `AYLO_OPERATOR_TOKEN` used by Day 18. The browser sends it as
a Bearer header for every mutation; unlocking the page is not treated as
permanent authorization.

The lead response does not expose the full booking ID. Each pending live lead
instead receives a random-IV AES-256-GCM action token that binds:

- the booking;
- the selected business;
- the expected pending status;
- a ten-minute expiry.

The server decrypts and validates this token only after re-authorizing the
operator. Modified, expired, wrong-key, and cross-business tokens are rejected.
The action token and operator token stay in the current page's memory and are
not written to local storage, session storage, cookies, URLs, or the repository.

This shared operator token remains an alpha safeguard. A public production
deployment still needs individual merchant authentication and ownership checks.

## API contract

```text
POST /api/leads/decision
Authorization: Bearer <AYLO_OPERATOR_TOKEN>
Content-Type: application/json
```

```json
{
  "actionToken": "v1.encrypted-token",
  "decision": "accepted",
  "confirmed": true
}
```

The input is strict: booking IDs and business IDs are not accepted from the
browser. Responses use `Cache-Control: private, no-store` and return only the
short reference, final status, response timestamp, and idempotency result.

Important responses include:

- `400` for invalid input or missing explicit confirmation;
- `401` for a missing or invalid operator token;
- `403` for an invalid or expired action token;
- `404` when the bound booking no longer belongs to the bound business;
- `409` for a conflicting final decision, expired appointment, or changed slot;
- `503` when server access or the Day 19 migration is unavailable.

## Demo and catalog behavior

- `operations`: decisions persist through the atomic Supabase function.
- `demo`: the same confirmation flow updates counts and filters in page memory;
  the success message explicitly says no database row changed.
- `catalog`: private bookings and decision actions remain unavailable.

Refreshing a demo page resets its simulated decisions. This is intentional and
prevents sample behavior from being presented as persistence.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Then verify:

1. In demo mode, choose **Accept**, cancel the dialog, and confirm that nothing
   changes.
2. Confirm the action; the lead leaves the New queue and appears under Accepted.
3. Repeat with **Reject** and confirm that the status counts update.
4. In live mode, unlock with `AYLO_OPERATOR_TOKEN` and confirm one pending lead.
5. Refresh Supabase: the booking status and `merchant_responded_at` must change.
6. For rejection, the future availability row must return to `available`.
7. Repeating the same API decision must succeed without a second transition.
8. Trying the opposite final decision must return `409`.
9. A modified or older-than-ten-minutes action token must return `403`.
10. Locking the inbox must clear the operator token and private lead data from
    page memory.
