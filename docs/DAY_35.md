# Day 35 — Booking list filters

`/bookings` now separates future active appointments from past or closed
bookings without changing the Day 31 private API or browser authorization.

| View | Entries |
| --- | --- |
| All | Every booking on this browser, in existing request order |
| Upcoming | Future `pending_confirmation` or `accepted` bookings, soonest appointment first |
| Past & closed | Past appointments, `rejected`, `cancelled`, and unknown statuses |

All remains the initial view. Each control shows a count and exposes its
pressed state to assistive technology. An empty filtered view offers **Show all
bookings**. Automatic and manual refresh update the counts, and a confirmed
cancellation moves the booking to Past & closed immediately. The view selection
stays in page memory; it is not saved in a URL, cookie, or browser storage.

Demo/catalog behavior stays honest: no private booking list or invented
history is displayed. No migration or new environment variable is required.

## Verification

```bash
npm run test:booking-status
npm test
npm run typecheck
npm run build
```

In live mode, create a future pending booking, have the provider accept or
reject another, then cancel one from this browser. Check the three counts,
the soonest-first Upcoming order, and the empty view when one group has no
entries. Refresh and confirm the chosen view stays selected on this page.
