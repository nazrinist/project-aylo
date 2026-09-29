begin;

alter table public.bookings
  add column if not exists consumer_cancelled_at timestamptz;

create or replace function public.detach_rejected_booking_slot()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.status in ('rejected', 'cancelled')
    and old.status is distinct from new.status then
    new.availability_id := null;
  end if;

  return new;
end
$$;

create or replace function public.cancel_consumer_booking(
  p_booking_id uuid,
  p_authorized_request_ids uuid[],
  p_user_confirmed boolean
)
returns table (
  cancellation_status text,
  cancellation_recorded_at timestamptz,
  was_updated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request_id uuid;
  v_request public.requests%rowtype;
  v_booking public.bookings%rowtype;
  v_slot public.availability%rowtype;
begin
  if p_user_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_REQUIRED';
  end if;

  if p_booking_id is null
    or coalesce(array_length(p_authorized_request_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  select booking_row.request_id
  into v_request_id
  from public.bookings as booking_row
  where booking_row.id = p_booking_id
    and booking_row.request_id = any(p_authorized_request_ids);

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  select request_row.*
  into v_request
  from public.requests as request_row
  where request_row.id = v_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  select booking_row.*
  into v_booking
  from public.bookings as booking_row
  where booking_row.id = p_booking_id
    and booking_row.request_id = v_request.id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status = 'cancelled' then
    if v_booking.consumer_cancelled_at is null then
      update public.bookings
      set consumer_cancelled_at = now()
      where id = v_booking.id
      returning * into v_booking;
    end if;

    return query select
      v_booking.status,
      v_booking.consumer_cancelled_at,
      false;
    return;
  end if;

  if v_booking.status not in ('pending_confirmation', 'accepted') then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_CANCELLABLE';
  end if;

  if v_booking.booked_for <= now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_EXPIRED';
  end if;

  if v_booking.availability_id is null then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_CONFLICT';
  end if;

  select slot_row.*
  into v_slot
  from public.availability as slot_row
  where slot_row.id = v_booking.availability_id
  for update;

  if not found
    or v_slot.business_id <> v_booking.business_id
    or v_slot.service_id is distinct from v_booking.service_id
    or v_slot.start_time <> v_booking.booked_for
    or v_slot.status <> 'booked' then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_CONFLICT';
  end if;

  update public.availability
  set status = 'available'
  where id = v_slot.id
    and status = 'booked';

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_CONFLICT';
  end if;

  update public.bookings
  set
    status = 'cancelled',
    consumer_cancelled_at = now()
  where id = v_booking.id
  returning * into v_booking;

  update public.requests
  set status = 'cancelled'
  where id = v_request.id;

  return query select
    v_booking.status,
    v_booking.consumer_cancelled_at,
    true;
end
$$;

revoke all on function public.cancel_consumer_booking(uuid, uuid[], boolean)
  from public, anon, authenticated;
grant execute on function public.cancel_consumer_booking(uuid, uuid[], boolean)
  to service_role;

comment on column public.bookings.consumer_cancelled_at is
  'Timestamp of an explicit browser-owned consumer cancellation.';

comment on function public.cancel_consumer_booking(uuid, uuid[], boolean) is
  'Atomically cancels one browser-owned future booking and releases its slot after explicit confirmation.';

commit;
