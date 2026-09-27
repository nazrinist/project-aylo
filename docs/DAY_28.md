# Day 28 — Source-backed provider candidates

Day 28 expands the Baku provider catalog with 40 real business candidates found
in public listings. It keeps discovery data separate from merchant-verified,
bookable inventory.

## Data boundary

Each candidate contains only:

- the public business name and address;
- the HTTPS listing used as its source;
- the date that source was checked;
- `onboarding_status = 'candidate'` and `verified = false`.

Ratings, coordinates, services, prices, and availability are intentionally
`null` or absent. A candidate therefore cannot appear as an Aylo offer: search
requires a matching active service and an available slot, and Day 28 creates
neither for candidate rows.

The original 12 fictional MVP businesses remain `sample` rows. On a clean
database the seed now produces 52 business rows and 13 sample services. The
number of open sample slots depends on the date and whether the seed was run
previously.

## Source provenance

The candidate names and addresses were checked on 2026-09-27 against these
public 2GIS listings:

- `https://2gis.az/baku/search/Gozelik%20salonu`
- `https://2gis.az/baku/search/Gozelik%20salonu/page/2`
- `https://2gis.az/baku/search/Gozelik%20salonu/page/3`
- `https://2gis.az/baku/search/Gozelik%20salonu/page/4`
- direct listing pages for First Beauty and Lacquer

`source_checked_at` records a source review, not merchant approval. The public
listing remains the authority if a name or address changes.

## Supabase setup

In the Supabase SQL Editor, run the contents of these files in order:

1. `supabase/migrations/0010_provider_provenance.sql`
2. `supabase/seed.sql`

The migration is additive: it creates three columns, validation constraints,
and an index. It does not drop or delete data. The candidate seed uses fixed
IDs with `on conflict (id) do nothing`, so rerunning it neither duplicates rows
nor overwrites a provider that an operator has started reviewing.

Restart the app after applying the SQL:

```bash
npm run dev
```

Open `/businesses`. The header should show `52 providers · 40 candidates` on a
clean database. Candidate cards display their status, source link, and source
check date.

## Promotion rule

Do not mark a candidate verified or create offers from a listing alone. Before
the provider becomes bookable, an operator must confirm the business details,
receive the provider's service names and prices, add valid availability, and
move the profile through a separate merchant onboarding flow. Day 29 validates
the consumer journey with invited testers; it does not promote candidates.

## Verification

Run the focused integrity suite:

```bash
npm run test:providers
```

It checks the exact 40-row count, unique stable IDs, Baku addresses, HTTPS
sources, fixed check date, absence of seeded services/availability, additive
migration constraints, and read-only provenance fields in the management UI.

Then run the complete checks:

```bash
npm test
npm run typecheck
npm run build
```
