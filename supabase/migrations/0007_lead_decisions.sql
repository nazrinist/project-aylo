alter table public.bookings
  add column if not exists merchant_responded_at timestamptz;

create index if not exists bookings_business_status_created_idx
  on public.bookings (business_id, status, created_at desc);

begin;

create or replace function public.decide_booking_lead(
  p_booking_id uuid,
  p_expected_business_id uuid,
  p_target_status text,
  p_operator_confirmed boolean
)
returns table (
  decision_status text,
  decision_responded_at timestamptz,
  was_updated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.availability%rowtype;
begin
  if p_operator_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_REQUIRED';
  end if;

  if p_target_status is null
    or p_target_status not in ('accepted', 'rejected') then
    raise exception using errcode = 'P0001', message = 'INVALID_LEAD_DECISION';
  end if;

  select booking_row.*
  into v_booking
  from public.bookings as booking_row
  where booking_row.id = p_booking_id
    and booking_row.business_id = p_expected_business_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LEAD_NOT_FOUND';
  end if;

  if v_booking.status = p_target_status then
    if v_booking.merchant_responded_at is null then
      update public.bookings
      set merchant_responded_at = now()
      where id = v_booking.id
      returning * into v_booking;
    end if;

    return query select
      v_booking.status,
      v_booking.merchant_responded_at,
      false;
    return;
  end if;

  if v_booking.status <> 'pending_confirmation' then
    raise exception using errcode = 'P0001', message = 'LEAD_ALREADY_DECIDED';
  end if;

  if v_booking.availability_id is null then
    raise exception using errcode = 'P0001', message = 'LEAD_SLOT_CONFLICT';
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
    raise exception using errcode = 'P0001', message = 'LEAD_SLOT_CONFLICT';
  end if;

  if p_target_status = 'accepted' and v_booking.booked_for <= now() then
    raise exception using errcode = 'P0001', message = 'LEAD_EXPIRED';
  end if;

  if p_target_status = 'rejected' then
    update public.availability
    set status = case
      when start_time > now() then 'available'
      else 'blocked'
    end
    where id = v_booking.availability_id
      and status = 'booked';

    if not found then
      raise exception using errcode = 'P0001', message = 'LEAD_SLOT_CONFLICT';
    end if;
  end if;

  update public.bookings
  set
    status = p_target_status,
    merchant_responded_at = now()
  where id = v_booking.id
  returning * into v_booking;

  return query select
    v_booking.status,
    v_booking.merchant_responded_at,
    true;
end
$$;

revoke all on function public.decide_booking_lead(
  uuid,
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.decide_booking_lead(
  uuid,
  uuid,
  text,
  boolean
) to service_role;

comment on function public.decide_booking_lead(
  uuid,
  uuid,
  text,
  boolean
) is
  'Atomically accepts or rejects one pending booking after locking its booking and availability rows.';

commit;
