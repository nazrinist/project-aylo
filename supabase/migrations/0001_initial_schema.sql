create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'beauty',
  address text,
  latitude double precision,
  longitude double precision,
  rating numeric(2,1),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2),
  currency text not null default 'AZN',
  duration_minutes integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'available' check (status in ('available','held','booked','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  original_request text not null,
  category text,
  services jsonb not null default '[]'::jsonb,
  location text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  requested_date date,
  time_from time,
  time_to time,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  price numeric(10,2),
  available_time timestamptz,
  match_score numeric(5,2),
  status text not null default 'proposed',
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  service_id uuid references public.services(id) on delete restrict,
  booked_for timestamptz not null,
  price numeric(10,2),
  status text not null default 'pending_confirmation',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  model text,
  status text not null,
  latency_ms integer,
  cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);
