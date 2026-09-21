# Day 20 — Availability management

Day 20 turns the original single-day slot CRUD screen into a protected
seven-day merchant schedule at `/availability`. The page shows all four slot
states, supports service and status filters, and keeps booking-owned time out of
manual mutation paths.

## Schedule states

| Status | Visible in live management | Manual actions |
| --- | --- | --- |
| `available` | Yes | Edit, block, or delete |
| `blocked` | Yes | Edit, reopen, or delete |
| `held` | Yes | Read-only; booking flow controlled |
| `booked` | Yes | Read-only; booking flow controlled |

Only future slots can change. Reopening a blocked slot re-runs the database
overlap constraint, so it cannot collide with an available, held, or booked
slot for the same service. Block and delete actions use a separate final
confirmation dialog.

## Data modes

| Mode | Configuration | Behavior |
| --- | --- | --- |
| `operations` | Supabase URL + secret key + `AYLO_OPERATOR_TOKEN` | All four states are visible and mutations persist |
| `catalog` | Supabase URL + publishable key only | Only public available slots are shown; actions are unavailable |
| `demo` | No Supabase keys | Sample schedule and in-memory mutations; refresh resets it |

Catalog mode reports held, booked, and blocked counts as unavailable rather
than inventing private operational totals.

## Database upgrade

Run the full contents of this file in Supabase SQL Editor:

```text
supabase/migrations/0008_availability_management.sql
```

Run the SQL **inside the file**, not the filename itself. Apply it after
`0007_lead_decisions.sql`.

The migration adds:

- an index for business/week/status schedule reads;
- `manage_availability_slot`, a single service-role-only mutation function;
- row locking and state revalidation for edit, block, reopen, and delete;
- future-window, active-service, business-ownership, and booking-reference
  checks;
- rejected-booking detachment so a released future slot is genuinely
  bookable again.

The function uses `SECURITY DEFINER` with a safe search path. Execution is
revoked from `public`, `anon`, and `authenticated`, then granted only to
`service_role`. Existing exclusion constraints still provide the final
concurrency-safe overlap check.

## Authorization and privacy

Live management requires the same 32+ character `AYLO_OPERATOR_TOKEN` as the
lead inbox. `GET /api/availability/manage` and every mutation verify the Bearer
token independently. Unlocking the page does not authorize later calls by
itself.

The token stays in React memory and is cleared by **Lock**. It is not written to
local storage, session storage, cookies, URLs, logs, or the repository.

The schedule data layer selects only businesses, services, and availability.
It never loads bookings, request text, user IDs, or customer identity. A slot's
`booked` or `held` status is enough to make it read-only.

This shared operator token is an internal-alpha safeguard, not production
merchant authentication. A public deployment still needs individual accounts
and per-business ownership checks.

## API contracts

Read one seven-day window:

```text
GET /api/availability/manage?startDate=2026-09-21&businessId=<uuid>
Authorization: Bearer <AYLO_OPERATOR_TOKEN>
```

Create or edit sends service and Baku-offset timestamps. Status and delete
actions send only the selected slot, business, target state when applicable,
and explicit confirmation:

```text
POST /api/availability/manage
Authorization: Bearer <AYLO_OPERATOR_TOKEN>
Content-Type: application/json
```

```json
{
  "action": "set_status",
  "slotId": "00000000-0000-4000-8000-000000000000",
  "businessId": "00000000-0000-4000-8000-000000000000",
  "targetStatus": "blocked",
  "confirmed": true
}
```

Inputs are strict and reject unsupported fields. Responses use
`Cache-Control: private, no-store`. Important responses include:

- `400` for invalid input, dates, windows, or missing confirmation;
- `401` for a missing or invalid operator token;
- `404` for an unknown business, service, or slot;
- `409` for protected, past, referenced, or overlapping slots;
- `503` when server access, operator configuration, or the migration is
  unavailable.

The older Day 6 write endpoints now also require the operator Bearer token,
reject past writes, and prevent deletion of held or booked slots.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Then verify:

1. In demo mode, filter all four states and browse the seven-day window.
2. Create and edit a sample slot; confirm the count and schedule update.
3. Block a slot, cancel the dialog, and confirm nothing changes.
4. Confirm block, reopen, and delete; refresh and confirm demo data resets.
5. In catalog mode, confirm only available slots appear and no form/actions are
   rendered.
6. In live mode, unlock with `AYLO_OPERATOR_TOKEN` and repeat the actions.
7. Try editing or deleting a held/booked slot; the UI and database must refuse.
8. Try reopening into an overlap; the API must return `409`.
9. Lock the page and confirm the token and live schedule disappear from memory.
10. Reject a future lead, then confirm its released slot can receive a new
    booking.

Day 21 adds privacy-minimized booking analytics at `/analytics`; it does not
change the availability mutation contract or require another migration.
