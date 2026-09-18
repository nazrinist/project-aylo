# Day 5 — Services CRUD

Day 5 adds service management to Aylo Business. Every service belongs to one
business and controls the offer shown by Aylo search.

## What can be managed

- Business
- Service name
- Description
- Price in AZN
- Duration in minutes
- Active or hidden status

An inactive service stays in the database but is excluded from customer search.

## Routes

- `GET /api/services` — list all services
- `GET /api/services?businessId=:id` — filter by provider
- `POST /api/services` — create a service
- `PATCH /api/services/:id` — update a service
- `DELETE /api/services/:id` — delete a service

Read operations use the publishable key. Write operations require the existing
server-only `SUPABASE_SECRET_KEY` from Day 4.

## Validation rules

- A valid business ID is required.
- Name must contain 2–100 characters.
- Description is optional and limited to 500 characters.
- Price must be between 0 and 10,000 AZN.
- Duration must be between 15 and 480 minutes.
- Currency is fixed to AZN for V1.

## Test the complete flow

1. Pull the latest `main` branch and restart the dev server.
2. Open `http://localhost:3000/services`.
3. Select the test business created on Day 4.
4. Add `Hair Styling`, price `45`, duration `60`.
5. Edit the price to `50`.
6. Turn off **Available in Aylo search** and save.
7. Turn it on again and verify it appears in customer search when availability exists.
8. Delete only the test service.

Deleting a service also deletes its linked availability slots because the
database foreign key uses `on delete cascade`.
