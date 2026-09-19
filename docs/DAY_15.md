# Day 15 — Booking confirmation flow

Day 15 adds the explicit user-confirmation step between ranked offers and a
future persisted booking. It intentionally performs no database write and sends
nothing to the provider; booking persistence belongs to Day 16.

## User flow

1. Select **Book appointment** on a result card, or **Book offer** in the
   comparison table.
2. Review the provider, service, Baku date/time, duration, total price, and
   location in an accessible dialog.
3. Acknowledge that every displayed detail was checked.
4. Select **Confirm booking details**.
5. Aylo records the explicit confirmation in the current browser session and
   marks the selected offer as confirmed but not sent.

The action can be cancelled with the visible button, close button, backdrop, or
Escape key. Opening the confirmed offer again shows the reviewed summary and
the persistence boundary.

## Draft contract

`createBookingDraft` snapshots the selected offer with:

- saved `requestId`, when Supabase request persistence is enabled;
- availability slot, business, and service IDs;
- booking time, duration, price, and currency;
- provider, service, and address display values.

`confirmBookingDraft` adds `userConfirmed: true` and an ISO confirmation
timestamp. Demo mode supports a null `requestId`, so the complete interface can
still be tested without credentials.

This draft is not trusted server data. Day 16 must re-read the slot and service,
recheck availability and price, reject replayed/stale requests, and then create
the private booking with the server-only Supabase client.

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
No migration or new environment variable is required.
