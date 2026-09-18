create index if not exists businesses_category_idx on public.businesses (category);
create index if not exists services_business_active_idx on public.services (business_id, active);
create index if not exists services_name_idx on public.services (lower(name));
create index if not exists availability_service_start_idx
  on public.availability (service_id, start_time)
  where status = 'available';
create unique index if not exists availability_unique_slot_idx
  on public.availability (service_id, start_time);

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;
alter table public.bookings enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists "Public can read businesses" on public.businesses;
create policy "Public can read businesses"
  on public.businesses for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
  on public.services for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Public can read available slots" on public.availability;
create policy "Public can read available slots"
  on public.availability for select
  to anon, authenticated
  using (status = 'available');

comment on table public.requests is
  'Private user requests. No public RLS policy: server-side service role only until Auth ships.';
comment on table public.bookings is
  'Private bookings. No public RLS policy: server-side service role only until Auth ships.';
