# Day 4 — Business CRUD

Day 4 adds the first Aylo Business administration screen. It can list, create,
edit, verify, and delete provider profiles in the real Supabase database.

## Security model

- `GET /api/businesses` uses the publishable key and public read policy.
- `POST /api/businesses` requires the server-only secret key.
- `PATCH /api/businesses/:id` requires the server-only secret key.
- `DELETE /api/businesses/:id` requires the server-only secret key.
- The browser never receives or reads the secret key.

This is a temporary founder-admin setup for local development. Before the
dashboard is deployed publicly, Aylo will add authentication and role checks.

## Add the server secret

Open Supabase **Settings → API Keys**. Create or copy a secret key beginning
with `sb_secret_`. Add it to `.env.local` without the `NEXT_PUBLIC_` prefix:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR_SECRET_KEY
```

Never paste the secret key into chat, commit it to GitHub, or expose it in a
browser variable. `.env.local` is already ignored by Git.

Restart the dev server after changing environment variables:

```bash
npm run dev
```

## Test the CRUD flow

1. Open `http://localhost:3000/businesses`.
2. Confirm the 12 seeded providers appear.
3. Create a provider named `Day 4 Test Studio`.
4. Edit its rating or verified status.
5. Delete only the test provider you created.
6. Return to Aylo search and confirm the provider catalog still loads.

## API contract

Create:

```http
POST /api/businesses
Content-Type: application/json

{
  "name": "Day 4 Test Studio",
  "category": "beauty",
  "address": "Ağ Şəhər, Bakı",
  "latitude": null,
  "longitude": null,
  "rating": 4.8,
  "verified": false
}
```

Update:

```http
PATCH /api/businesses/:id
```

Delete:

```http
DELETE /api/businesses/:id
```

All request bodies and URL IDs are validated before the database query runs.
