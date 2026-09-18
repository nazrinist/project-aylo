# Day 6 — Availability management

Day 6 adds a complete availability workflow at `/availability`.

## What works

- Select a business, one of its active services, and a date.
- Create, update, and delete bookable time slots.
- Times entered in the UI are interpreted as `Asia/Baku` (`UTC+04:00`).
- The end time is suggested from the selected service duration.
- Public reads use the Supabase publishable key and RLS.
- Writes stay server-side and require `SUPABASE_SECRET_KEY`.
- Overlapping active slots are rejected in both the API and PostgreSQL.

Adjacent slots are valid. For example, `10:00–11:00` and `11:00–12:00` do not
overlap.

## Database upgrade

Run the full contents of this file in the Supabase SQL Editor:

```text
supabase/migrations/0004_availability_integrity.sql
```

Run the SQL inside the file, not the filename itself. The migration adds:

- an `end_time > start_time` check;
- a PostgreSQL exclusion constraint for overlapping `available`, `held`, or
  `booked` slots belonging to the same service.

The migration is safe to run again because it checks whether each constraint
already exists.

## Test

1. Start the app with `npm run dev`.
2. Open `http://localhost:3000/availability`.
3. Select a business, service, and date.
4. Create a slot and verify that it appears in the list.
5. Try creating another slot that overlaps it; the API should reject it.
6. Edit the original slot, then delete it.

No new environment variable is required for Day 6.
