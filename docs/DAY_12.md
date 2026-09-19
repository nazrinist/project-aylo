# Day 12 — Explainable ranking engine

Day 12 moves scoring out of the search orchestrator into a dedicated,
deterministic ranking engine. Provider and availability tools decide eligibility;
the ranking engine orders only the results that passed every hard filter.

## Ranking v1

The score is a percentage-like value from 0 to 100:

| Factor | Maximum | Rule |
| --- | ---: | --- |
| Service coverage | 35 | Proportional to requested services covered. Hard filters currently require full coverage. |
| Time fit | 25 | Exact preferred time gets full points; the score decreases with distance. No preference gets neutral full points. |
| Budget fit | 15 | Eligible prices receive 10–15 points, with more headroom below the maximum receiving more points. No maximum gets neutral full points. |
| Rating | 15 | Rating is normalized from 0–5. A provider without a rating uses a neutral 4.0 baseline. |
| Location | 5 | Requested area match. Hard filters currently require it. |
| Verified | 5 | Verified provider bonus. |

The weights total exactly 100. Prices outside the requested range receive zero
budget points if the scorer is called directly, although normal search removes
them before ranking.

## Explainable response

`POST /api/search` now identifies the ranking version and weights:

```json
{
  "ranking": {
    "version": "v1",
    "weights": {
      "service": 35,
      "time": 25,
      "budget": 15,
      "rating": 15,
      "location": 5,
      "verified": 5
    }
  }
}
```

Every result includes its own breakdown and user-facing reasons:

```json
{
  "businessName": "Glow Studio",
  "matchScore": 95.7,
  "scoreBreakdown": {
    "service": 35,
    "time": 25,
    "budget": 11,
    "rating": 14.7,
    "location": 5,
    "verified": 5,
    "total": 95.7
  },
  "reasons": [
    "All requested services match",
    "Exact preferred time",
    "Within budget"
  ]
}
```

The existing result cards continue to display `matchScore` and the three concise
reasons. Day 13 can improve the card presentation without changing the API.

## Stable ordering

Results are sorted by:

1. total score, descending;
2. price, ascending;
3. available time, ascending;
4. business name, then slot ID.

This keeps repeated searches predictable even when two offers receive the same
score.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The ranking tests verify the 100-point weight model, exact score breakdown,
factor effects, neutral handling of missing preferences, bounded scores, stable
tie-breakers, and result limits.

No database migration or environment variable is required for Day 12.
