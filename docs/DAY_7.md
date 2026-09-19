# Day 7 — Deterministic search filters

Day 7 makes provider filtering predictable and identical in demo and Supabase
mode. AI still extracts the intent, but normal TypeScript decides which results
are eligible.

## Hard filter rules

| Intent field | Rule |
| --- | --- |
| `category` | Only `beauty` is supported in V1. |
| `services` | A result must cover every requested service. |
| `location` | The normalized address must match the requested area. |
| `date` | Supabase availability must start on that Baku calendar date. |
| `time_from` only | The slot must be within 60 minutes of the requested time. |
| `time_from` + `time_to` | The slot must start inside the inclusive window. Overnight windows are supported. |
| `budget_min` / `budget_max` | Price must remain inside the exact inclusive range. |
| `currency` | The service currency must match the requested currency. |

The old 25% budget overflow has been removed. For example, a 121 AZN service is
not returned for a 120 AZN maximum.

## Stable ranking

Eligible results are ordered by:

1. match score, descending;
2. price, ascending;
3. available time, ascending;
4. business name and ID as stable tie-breakers.

The home page displays the applied constraints as chips above the results.

## Validation and tests

Dates must use `YYYY-MM-DD`, times must use `HH:mm`, budgets cannot be negative,
and the minimum budget cannot exceed the maximum.

Run:

```bash
npm test
npm run typecheck
npm run build
```

No database migration or new environment variable is required for Day 7.
