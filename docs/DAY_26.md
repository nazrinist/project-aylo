# Day 26 — Prompt test suite

Day 26 turns the intent prompt into a versioned, testable contract. The suite
runs locally without an OpenAI key, network access, model cost, or
non-deterministic live responses.

## What is tested

`tests/fixtures/intent-evals.json` is the golden corpus. It currently covers:

- Azerbaijani and English requests;
- explicit, relative, and missing dates;
- evening and exact time normalization;
- service, location, and budget extraction;
- multi-step follow-up input;
- unsupported categories;
- medical/invasive boundaries and instruction attacks.

Every relative-date case supplies its own fixed `today` value. Tests therefore
do not change depending on the machine clock or timezone.

`tests/prompt-evals.test.ts` also verifies that:

- prompt version `v2` keeps untrusted input only in the user role;
- the system instruction declares the exact output contract and no-invention
  rule;
- plain and fenced JSON can be parsed;
- malformed JSON, invalid dates, arrays, and unexpected fields are rejected;
- `original_request` always comes from the server input, not model output;
- deterministic missing-field normalization replaces model guesses.

## Production changes

The prompt and parser now live in `lib/ai/intent-prompt.ts`. The production
OpenAI path and tests use the same builder and parser, preventing the suite from
testing a duplicate prompt. `IntentSchema` is strict, so model or direct API
payloads cannot add undeclared properties.

The demo parser accepts an injected clock for tests while production continues
to default to the current date.

## Run the suite

Run only prompt evaluations:

```bash
npm run test:prompts
```

Run the complete regression suite:

```bash
npm test
npm run typecheck
npm run build
```

When the prompt contract changes, increment `INTENT_PROMPT_VERSION`, update the
golden corpus deliberately, and review every changed expectation. Live model
quality evaluation can be added later as a separate opt-in job; it must never
replace these deterministic checks.

No Supabase migration is required for Day 26.
