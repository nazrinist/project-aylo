create index if not exists availability_business_start_status_idx
  on public.availability (business_id, start_time, status);

-- A rejected lead releases its future slot. Detaching the historical booking
-- makes that exact availability row bookable again while booked_for keeps the
-- original appointment timestamp on the rejected record.
update public.bookings as booking_row
set availability_id = null
where booking_row.status = 'rejected'
  and booking_row.availability_id is not null
  and exists (
    select 1
    from public.availability as slot_row
    where slot_row.id = booking_row.availability_id
      and slot_row.status in ('available', 'blocked')
  );

create or replace function public.detach_rejected_booking_slot()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.status = 'rejected'
    and old.status is distinct from new.status then
    new.availability_id := null;
  end if;

  return new;
end
$$;

drop trigger if exists bookings_detach_rejected_slot
  on public.bookings;

create trigger bookings_detach_rejected_slot
before update of status on public.bookings
for each row
execute function public.detach_rejected_booking_slot();

revoke all on function public.detach_rejected_booking_slot()
  from public, anon, authenticated;

begin;

create or replace function public.manage_availability_slot(
  p_action text,
  p_slot_id uuid,
  p_expected_business_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_target_status text,
  p_operator_confirmed boolean
)
returns table (
  slot_id uuid,
  slot_business_id uuid,
  slot_service_id uuid,
  slot_service_name text,
  slot_start_time timestamptz,
  slot_end_time timestamptz,
  slot_status text,
  mutation_changed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_slot public.availability%rowtype;
  v_service public.services%rowtype;
  v_changed boolean := true;
begin
  if p_operator_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_REQUIRED';
  end if;

  if p_action is null
    or p_action not in ('create', 'update', 'set_status', 'delete') then
    raise exception using errcode = 'P0001', message = 'INVALID_AVAILABILITY_ACTION';
  end if;

  if p_expected_business_id is null then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_FOUND';
  end if;

  if p_action = 'create' then
    if p_service_id is null
      or p_start_time is null
      or p_end_time is null
      or p_start_time <= now()
      or p_end_time <= p_start_time
      or p_end_time - p_start_time > interval '12 hours' then
      raise exception using errcode = 'P0001', message = 'INVALID_SLOT_WINDOW';
    end if;

    select service_row.*
    into v_service
    from public.services as service_row
    where service_row.id = p_service_id
      and service_row.business_id = p_expected_business_id
      and service_row.active is true;

    if not found then
      raise exception using errcode = 'P0001', message = 'SERVICE_NOT_FOUND';
    end if;

    insert into public.availability (
      business_id,
      service_id,
      start_time,
      end_time,
      status
    )
    values (
      p_expected_business_id,
      p_service_id,
      p_start_time,
      p_end_time,
      'available'
    )
    returning * into v_slot;

    return query select
      v_slot.id,
      v_slot.business_id,
      v_slot.service_id,
      v_service.name,
      v_slot.start_time,
      v_slot.end_time,
      v_slot.status,
      true;
    return;
  end if;

  if p_slot_id is null then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_FOUND';
  end if;

  select slot_row.*
  into v_slot
  from public.availability as slot_row
  where slot_row.id = p_slot_id
    and slot_row.business_id = p_expected_business_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_FOUND';
  end if;

  if v_slot.status in ('held', 'booked') then
    raise exception using errcode = 'P0001', message = 'SLOT_PROTECTED';
  end if;

  if v_slot.start_time <= now() then
    raise exception using errcode = 'P0001', message = 'SLOT_EXPIRED';
  end if;

  if exists (
    select 1
    from public.bookings as booking_row
    where booking_row.availability_id = v_slot.id
  ) then
    raise exception using errcode = 'P0001', message = 'SLOT_PROTECTED';
  end if;

  if p_action = 'update' then
    if p_service_id is null
      or p_start_time is null
      or p_end_time is null
      or p_start_time <= now()
      or p_end_time <= p_start_time
      or p_end_time - p_start_time > interval '12 hours' then
      raise exception using errcode = 'P0001', message = 'INVALID_SLOT_WINDOW';
    end if;

    select service_row.*
    into v_service
    from public.services as service_row
    where service_row.id = p_service_id
      and service_row.business_id = p_expected_business_id
      and service_row.active is true;

    if not found then
      raise exception using errcode = 'P0001', message = 'SERVICE_NOT_FOUND';
    end if;

    update public.availability
    set
      service_id = p_service_id,
      start_time = p_start_time,
      end_time = p_end_time
    where id = v_slot.id
    returning * into v_slot;
  elsif p_action = 'set_status' then
    if p_target_status is null
      or p_target_status not in ('available', 'blocked') then
      raise exception using errcode = 'P0001', message = 'INVALID_AVAILABILITY_ACTION';
    end if;

    select service_row.*
    into v_service
    from public.services as service_row
    where service_row.id = v_slot.service_id
      and service_row.business_id = p_expected_business_id;

    if not found
      or (p_target_status = 'available' and v_service.active is distinct from true) then
      raise exception using errcode = 'P0001', message = 'SERVICE_NOT_FOUND';
    end if;

    if v_slot.status = p_target_status then
      v_changed := false;
    else
      update public.availability
      set status = p_target_status
      where id = v_slot.id
      returning * into v_slot;
    end if;
  else
    select service_row.*
    into v_service
    from public.services as service_row
    where service_row.id = v_slot.service_id
      and service_row.business_id = p_expected_business_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'SERVICE_NOT_FOUND';
    end if;

    delete from public.availability
    where id = v_slot.id;
  end if;

  return query select
    v_slot.id,
    v_slot.business_id,
    v_slot.service_id,
    v_service.name,
    v_slot.start_time,
    v_slot.end_time,
    v_slot.status,
    v_changed;
end
$$;

revoke all on function public.manage_availability_slot(
  text,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.manage_availability_slot(
  text,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  boolean
) to service_role;

comment on function public.manage_availability_slot(
  text,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  boolean
) is
  'Atomically creates, edits, blocks, reopens, or deletes a future unreserved availability slot.';

commit;
