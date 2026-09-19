# Day 14 — Compare offers

Day 14 adds a client-side comparison flow on top of the ranked search results.
No new API route, environment variable, or database migration is required.

## User flow

1. Run a search that returns at least two providers.
2. Select **Compare** on up to three result cards.
3. With one selection, Aylo asks for one more offer.
4. With two or three selections, Aylo opens a side-by-side comparison table.
5. Remove one offer or use **Clear all** to reset the comparison.

The selected columns always follow the original ranked result order, even when
the user selects the lower-ranked card first.

## Compared fields

- match score;
- price and currency;
- available time in the Baku time zone;
- duration;
- provider rating and verified status;
- service and location;
- all six ranking factors returned by ranking version `v1`.

Aylo marks every tied winner for best score, lowest price, best time fit, and
top provider rating. A missing rating is shown as `New provider` and is not
treated as a winning rating.

## Accessibility and responsive behavior

- comparison toggles expose `aria-pressed`;
- remove buttons have provider-specific accessible labels;
- the comparison uses a semantic table with row and column headers;
- the table wrapper is keyboard focusable and horizontally scrollable on
  narrow screens;
- selected cards receive both a visual border and a text state.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Automated coverage verifies the three-offer limit, add/remove behavior,
ranking-order preservation, tied highlights, missing ratings, comparison
markup, and the one-selection prompt.
