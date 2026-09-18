create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_end_after_start'
      and conrelid = 'public.availability'::regclass
  ) then
    alter table public.availability
      add constraint availability_end_after_start
      check (end_time > start_time);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_no_service_overlap'
      and conrelid = 'public.availability'::regclass
  ) then
    alter table public.availability
      add constraint availability_no_service_overlap
      exclude using gist (
        service_id with =,
        tstzrange(start_time, end_time, '[)') with &&
      )
      where (
        service_id is not null
        and status in ('available', 'held', 'booked')
      );
  end if;
end
$$;

comment on constraint availability_no_service_overlap on public.availability is
  'Prevents concurrent writes from creating overlapping active slots for one service.';
