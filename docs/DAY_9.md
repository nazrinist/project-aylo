# Day 9 — Missing-field follow-up questions

Day 9 prevents premature searches when the request is missing information that
is required for a useful provider match.

## Required fields

Aylo checks these fields deterministically and asks for the first missing one:

1. service;
2. Baku area;
3. date.

Time and budget remain optional filters. The model may suggest
`missing_fields`, but server-side TypeScript recalculates the list so the flow
does not depend on model judgment.

## Conversation flow

For an input such as:

```text
Saç düzümü istəyirəm.
```

Aylo asks for an area, then a date. Each answer is combined with the original
request and parsed again. Search and Day 8 request persistence run only after
all required fields are present.

The UI includes example-answer buttons and **Start over**. Only one follow-up is
shown at a time.

## Test

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:3000` and enter `Saç düzümü istəyirəm.`. Choose an area,
then choose a date. The provider search should start after the date answer.

No database migration or new environment variable is required for Day 9.
