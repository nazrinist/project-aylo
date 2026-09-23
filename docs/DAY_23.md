# Day 23 — Search preferences

Day 23 adds optional browser-bound defaults for location and maximum budget.
They reduce repeated follow-up questions without changing Aylo's core rule:
values written in the current request always win.

## What is saved

- default location, such as `Ağ Şəhər, Bakı`;
- optional maximum budget and its three-letter currency;
- no default service, date, or time.

The last restriction prevents an old preference from silently narrowing a new
booking to the wrong service or day.

## Privacy and security

`PUT /api/preferences` validates a strict payload, encrypts it with AES-256-GCM,
and stores only the authenticated ciphertext in the `aylo_search_preferences`
cookie. The cookie is `HttpOnly`, `SameSite=Lax`, production-only `Secure`, and
expires after 180 days. Browser JavaScript cannot read it.

Use a server-side secret of at least 32 characters:

```env
PREFERENCES_SECRET=replace-with-a-random-secret-of-at-least-32-characters
```

For existing installations, Aylo can fall back to another configured
server-only application secret. A dedicated `PREFERENCES_SECRET` is still the
clearest setup. Restart the server after changing `.env.local`.

## Merge rules

1. The intent extractor parses the current request.
2. The server reads and decrypts the preferences cookie.
3. A saved location is used only when the request has no location.
4. A saved maximum budget is used only when the request has neither a minimum
   nor maximum budget.
5. Required-field follow-up questions run after this merge.

The API response lists applied defaults in `appliedPreferences`; the search UI
shows a notice when one was used.

## End-to-end check

1. Open `/preferences` and save `Nərimanov, Bakı` with a maximum of `80 AZN`.
2. Search for `Sabah saç düzümü istəyirəm`.
3. Confirm that Aylo applies both saved defaults and does not ask for location.
4. Search for `Sabah Xətaidə 120 AZN-dən ucuz saç düzümü istəyirəm`.
5. Confirm that `Xətai` and `120 AZN` override the saved defaults.
6. Clear the values on `/preferences` and confirm that the first request asks
   for a location again.

No Supabase migration is required. Run `npm test`, `npm run typecheck`, and
`npm run build` for the automated proof.
