# Day 15 — Booking confirmation flow

Day 15 added the explicit user-confirmation step between ranked offers and a
persisted booking. At that milestone it intentionally performed no database
write. Day 16 now keeps the same review boundary and persists eligible live
confirmations; demo confirmations still remain browser-only.

## User flow

1. Select **Book appointment** on a result card, or **Book offer** in the
   comparison table.
2. Review the provider, service, Baku date/time, duration, total price, and
   location in an accessible dialog.
3. Acknowledge that every displayed detail was checked.
4. Select the explicit confirmation action.
5. In demo mode, Aylo records the confirmation only in the current browser
   session. With Day 16 live persistence, the server revalidates and saves it.

The action can be cancelled with the visible button, close button, backdrop, or
Escape key. Opening the confirmed offer again shows the reviewed summary and
the persistence boundary.

## Draft contract

`createBookingDraft` snapshots the selected offer with:

- saved `requestId`, when Supabase request persistence is enabled;
- opaque `bookingToken`, when the live offer is eligible for persistence;
- availability slot, business, and service IDs;
- booking time, duration, price, and currency;
- provider, service, and address display values.

`confirmBookingDraft` adds `userConfirmed: true` and an ISO confirmation
timestamp. Demo mode supports a null `requestId`, so the complete interface can
still be tested without credentials.

This draft is not trusted server data. Day 16 re-reads the slot and service,
rechecks availability and price, rejects changed or replayed requests, and then
creates the private booking with the server-only Supabase client. See
[DAY_16.md](./DAY_16.md) for that write path.

## Accessibility

- the overlay exposes dialog and modal semantics;
- focus moves into the dialog and returns to the triggering control on close;
- keyboard focus is kept inside the dialog;
- Escape closes the flow;
- the confirmation button stays disabled until the explicit checkbox is set;
- success and persistent page status use clear text, not color alone.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Tests cover draft mapping, demo mode, timestamp validation, both dialog states,
the explicit acknowledgement guard, card state, and comparison booking actions.
Day 15 itself requires no migration; live persistence additionally requires the
Day 16 migration.
