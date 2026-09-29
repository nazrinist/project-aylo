begin;

alter table public.bookings
  add column if not exists consumer_rescheduled_at timestamptz;

create or replace function public.reschedule_consumer_booking(
  p_booking_id uuid,
  p_authorized_request_ids uuid[],
  p_expected_booked_for timestamptz,
  p_expected_rescheduled_at timestamptz,
  p_new_slot_id uuid,
  p_user_confirmed boolean
)
returns table (new_booked_for timestamptz, new_status text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request_id uuid;
  v_request public.requests%rowtype;
  v_booking public.bookings%rowtype;
  v_old_slot public.availability%rowtype;
  v_new_slot public.availability%rowtype;
begin
  if p_user_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_REQUIRED';
  end if;
  if p_booking_id is null or p_new_slot_id is null or
    coalesce(array_length(p_authorized_request_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  select b.request_id into v_request_id
  from public.bookings b
  where b.id = p_booking_id and b.request_id = any(p_authorized_request_ids);
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  select r.* into v_request from public.requests r where r.id = v_request_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  select b.* into v_booking from public.bookings b
  where b.id = p_booking_id and b.request_id = v_request.id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status not in ('pending_confirmation', 'accepted') or
    v_booking.booked_for <= now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_RESCHEDULABLE';
  end if;
  if v_booking.booked_for is distinct from p_expected_booked_for then
    raise exception using errcode = 'P0001', message = 'BOOKING_CHANGED';
  end if;
  if v_booking.consumer_rescheduled_at is distinct from p_expected_rescheduled_at then
    raise exception using errcode = 'P0001', message = 'BOOKING_CHANGED';
  end if;
  if v_booking.availability_id is null or v_booking.availability_id = p_new_slot_id then
    raise exception using errcode = 'P0001', message = 'BOOKING_CHANGED';
  end if;

  select a.* into v_old_slot from public.availability a
  where a.id = v_booking.availability_id for update;
  if not found or v_old_slot.status <> 'booked' or
    v_old_slot.business_id <> v_booking.business_id or
    v_old_slot.service_id is distinct from v_booking.service_id or
    v_old_slot.start_time <> v_booking.booked_for then
    raise exception using errcode = 'P0001', message = 'BOOKING_CHANGED';
  end if;

  select a.* into v_new_slot from public.availability a
  where a.id = p_new_slot_id for update;
  if not found or v_new_slot.status <> 'available' or
    v_new_slot.business_id <> v_booking.business_id or
    v_new_slot.service_id is distinct from v_booking.service_id or
    v_new_slot.start_time <= now() or
    v_new_slot.start_time > now() + interval '30 days' or
    exists (select 1 from public.bookings b where b.availability_id = v_new_slot.id) or
    not exists (
      select 1 from public.services s
      where s.id = v_booking.service_id and s.business_id = v_booking.business_id
        and s.active is true
    ) then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  update public.availability set status = 'booked'
  where id = v_new_slot.id and status = 'available';
  if not found then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  update public.bookings
  set availability_id = v_new_slot.id,
      booked_for = v_new_slot.start_time,
      status = 'pending_confirmation',
      merchant_responded_at = null,
      consumer_rescheduled_at = now()
  where id = v_booking.id;

  update public.availability set status = 'available'
  where id = v_old_slot.id and status = 'booked';
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_CHANGED';
  end if;

  return query select v_new_slot.start_time, 'pending_confirmation'::text;
end
$$;

revoke all on function public.reschedule_consumer_booking(uuid, uuid[], timestamptz, timestamptz, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reschedule_consumer_booking(uuid, uuid[], timestamptz, timestamptz, uuid, boolean)
  to service_role;

comment on column public.bookings.consumer_rescheduled_at is
  'Timestamp of the latest browser-owned appointment change.';

commit;
