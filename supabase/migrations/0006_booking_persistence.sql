alter table public.bookings
  add column if not exists availability_id uuid,
  add column if not exists currency text not null default 'AZN',
  add column if not exists user_confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_availability_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_availability_id_fkey
      foreign key (availability_id)
      references public.availability(id)
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_price_nonnegative'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_price_nonnegative
      check (price is null or price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_status_allowed'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_status_allowed
      check (status in ('pending_confirmation', 'accepted', 'rejected', 'cancelled'));
  end if;
end
$$;

create unique index if not exists bookings_availability_unique_idx
  on public.bookings (availability_id)
  where availability_id is not null;

create unique index if not exists bookings_request_unique_idx
  on public.bookings (request_id);

create index if not exists bookings_status_created_idx
  on public.bookings (status, created_at desc);

begin;

create or replace function public.create_booking_from_confirmation(
  p_request_id uuid,
  p_availability_id uuid,
  p_expected_business_id uuid,
  p_expected_service_id uuid,
  p_expected_booked_for timestamptz,
  p_expected_price numeric,
  p_expected_currency text,
  p_user_confirmed boolean
)
returns table (
  booking_id uuid,
  booking_request_id uuid,
  booking_availability_id uuid,
  booking_business_id uuid,
  booking_service_id uuid,
  booking_booked_for timestamptz,
  booking_price numeric,
  booking_currency text,
  booking_status text,
  booking_user_confirmed_at timestamptz,
  booking_created_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request public.requests%rowtype;
  v_slot public.availability%rowtype;
  v_service public.services%rowtype;
  v_booking public.bookings%rowtype;
begin
  if p_user_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_REQUIRED';
  end if;

  select request_row.*
  into v_request
  from public.requests as request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_READY';
  end if;

  select booking_row.*
  into v_booking
  from public.bookings as booking_row
  where booking_row.request_id = p_request_id
  limit 1;

  if found then
    if v_booking.availability_id = p_availability_id then
      return query select
        v_booking.id,
        v_booking.request_id,
        v_booking.availability_id,
        v_booking.business_id,
        v_booking.service_id,
        v_booking.booked_for,
        v_booking.price,
        v_booking.currency,
        v_booking.status,
        v_booking.user_confirmed_at,
        v_booking.created_at,
        false;
      return;
    end if;

    raise exception using errcode = 'P0001', message = 'REQUEST_ALREADY_BOOKED';
  end if;

  if v_request.status <> 'searched' then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_READY';
  end if;

  select slot_row.*
  into v_slot
  from public.availability as slot_row
  where slot_row.id = p_availability_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_FOUND';
  end if;

  select booking_row.*
  into v_booking
  from public.bookings as booking_row
  where booking_row.availability_id = p_availability_id
  limit 1;

  if found then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  if v_slot.status <> 'available' then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  if v_slot.start_time <= now() then
    raise exception using errcode = 'P0001', message = 'SLOT_EXPIRED';
  end if;

  if v_slot.business_id <> p_expected_business_id
    or v_slot.service_id is distinct from p_expected_service_id
    or v_slot.start_time <> p_expected_booked_for then
    raise exception using errcode = 'P0001', message = 'OFFER_CHANGED';
  end if;

  select service_row.*
  into v_service
  from public.services as service_row
  where service_row.id = p_expected_service_id
    and service_row.business_id = p_expected_business_id;

  if not found or v_service.active is distinct from true then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;

  if v_service.price is null
    or v_service.price <> p_expected_price
    or upper(v_service.currency) <> upper(p_expected_currency) then
    raise exception using errcode = 'P0001', message = 'OFFER_CHANGED';
  end if;

  insert into public.bookings (
    request_id,
    availability_id,
    business_id,
    service_id,
    booked_for,
    price,
    currency,
    status,
    user_confirmed_at
  )
  values (
    p_request_id,
    p_availability_id,
    p_expected_business_id,
    p_expected_service_id,
    v_slot.start_time,
    v_service.price,
    upper(v_service.currency),
    'pending_confirmation',
    now()
  )
  returning * into v_booking;

  update public.availability
  set status = 'booked'
  where id = p_availability_id
    and status = 'available';

  if not found then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  update public.requests
  set status = 'completed'
  where id = p_request_id;

  return query select
    v_booking.id,
    v_booking.request_id,
    v_booking.availability_id,
    v_booking.business_id,
    v_booking.service_id,
    v_booking.booked_for,
    v_booking.price,
    v_booking.currency,
    v_booking.status,
    v_booking.user_confirmed_at,
    v_booking.created_at,
    true;
end
$$;

revoke all on function public.create_booking_from_confirmation(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  numeric,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.create_booking_from_confirmation(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  numeric,
  text,
  boolean
) to service_role;

comment on function public.create_booking_from_confirmation(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  numeric,
  text,
  boolean
) is
  'Atomically revalidates an offer, creates one booking per request and slot, and marks the slot booked.';

commit;
