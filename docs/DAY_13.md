# Day 13 — Result cards

Day 13 turns the ranked search response into clear, decision-ready offer cards.
The UI consumes the score and weights returned by the API; it does not duplicate
or recalculate ranking logic in the browser.

## Card hierarchy

Each card now shows:

- best-match rank and verified-provider badges;
- total match score and a visual progress track;
- provider initials, business name, and service;
- price, available Baku time, and service duration;
- provider rating and address;
- the three strongest match reasons;
- an expandable six-factor score breakdown;
- the disabled booking action reserved for the booking milestone.

The first result spans the full result grid and receives a subtle highlighted
surface. Remaining results use a two-column desktop grid. On mobile, all cards
collapse to one column, offer facts reflow, and score factors stack vertically.

## Explainability

“Why this match?” reads `scoreBreakdown` from Day 12 and renders each factor
against the `ranking.weights` returned by `/api/search`:

- service match;
- time fit;
- budget fit;
- provider rating;
- location;
- verified status.

This keeps the UI aligned if ranking weights change in a future version.

## Accessibility

- Every card is labelled by its provider heading.
- The total score and all six factor bars expose progressbar semantics.
- Score details use native `<details>` and `<summary>` controls, so they remain
  keyboard accessible without custom JavaScript.
- Reduced-motion preferences disable card transitions.
- Booking remains visibly and semantically disabled until that flow exists.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Presentation tests cover match labels, provider initials, duration formatting,
factor percentages, and server-rendered card structure. The rendered-card test
also verifies seven accessible progress bars and the disabled booking action.

No database migration or environment variable is required for Day 13.
