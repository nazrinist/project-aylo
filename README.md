# Project Aylo

> From intent to done.

Project Aylo is an AI action layer that turns a user's natural-language request into a structured intent, finds matching providers, ranks offers and ultimately completes a booking with explicit user confirmation.

## MVP
The first wedge is **beauty services in Baku**.

Example:

> “Tomorrow at 6, find me hair + makeup near White City under 120 AZN.”

Aylo extracts the constraints, searches providers and availability, ranks the best matches, then asks the user to confirm before booking.

## Stack
- Next.js 16.3.3
- React 19.3
- TypeScript
- OpenAI Node SDK
- Supabase / Postgres
- Node.js 24

## Start locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add at minimum:

```env
OPENAI_API_KEY=...
```

Then open `http://localhost:3000`.

## Day 1 proof
`POST /api/intent`

```json
{
  "request": "Sabah axşam Ağ Şəhərdə 100 manatdan ucuz saç və makeup istəyirəm"
}
```

returns a normalized intent object used by the future search engine.

## Product rules
1. AI interprets intent; deterministic code handles filtering and permissions.
2. No irreversible action without explicit user confirmation.
3. V1 stays narrow: beauty first, universal agent later.
4. Optimize for **completed intents**, not chat messages.

See [ROADMAP.md](./ROADMAP.md) and [docs/PRODUCT.md](./docs/PRODUCT.md).
