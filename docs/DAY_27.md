# Day 27 — Edge-case hardening

Day 27 closes the temporal and data-boundary gaps that could otherwise show an
unbookable offer or persist a search that should never have started. All time
decisions use the Baku calendar and an injectable clock, so the regression
suite remains deterministic.

## Search preflight

Before request persistence or provider execution, the server now rejects:

- unsupported categories;
- intents missing a supported service, Baku area, or date;
- dates that have already passed in Baku;
- same-day time windows that have already closed.

These cases return stable `422` codes:

| Code | Meaning |
| --- | --- |
| `SEARCH_CATEGORY_UNSUPPORTED` | The request is outside Aylo V1 beauty services. |
| `SEARCH_INTENT_INCOMPLETE` | A required search field is absent. |
| `SEARCH_DATE_PAST` | The requested Baku date has passed. |
| `SEARCH_TIME_PAST` | Today's requested time window has closed. |

Preflight runs before `createSearchRequest`, so rejected input does not create a
private failed-search row. The provider orchestrator repeats the same check as
defense in depth.

## Strict intent boundary

The intent and `searchProviders` contracts now accept only the five V1 service
identifiers: `hair`, `makeup`, `nails`, `lashes`, and `brows`. Duplicate values
are removed in stable order. Contradictory `unknown` category payloads,
unsupported services, blank original requests, non-finite budgets, and budgets
above `1,000,000` are rejected before tool execution.

## Availability hygiene

Availability results are sorted and then defensively reduced before ranking:

- expired starts are removed;
- invalid timestamps, non-positive durations, and durations over 12 hours are
  removed;
- slots outside the requested Baku calendar window are removed;
- duplicate service/time offers are collapsed deterministically;
- a slot whose business does not match its service is ignored.

The database booking function still performs the final atomic revalidation.
Day 27 prevents obviously stale or corrupt rows from reaching the user in the
first place.

## Midnight behavior

An explicit window such as `22:00–02:00` now means 22:00 on the requested Baku
date through 02:00 on the next Baku date. The live Supabase query covers that
exact interval and the in-memory filter verifies both calendar dates.

A single preferred time keeps its ±60-minute tolerance inside the selected
calendar day. For example, `00:30` no longer treats `23:30` later that same day
as a close match.

## Verification

Run the focused suite:

```bash
npm run test:edge-cases
```

Then run the full project checks:

```bash
npm test
npm run typecheck
npm run build
```

The focused suite covers Baku midnight rollover, past dates and windows,
unsupported or incomplete intents, single-time boundaries, true overnight
queries, expired/malformed/duplicate slots, safe API errors, and pre-persistence
validation order.

No Supabase migration or new environment variable is required for Day 27.
