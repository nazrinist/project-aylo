alter table public.requests
  add column if not exists currency text not null default 'AZN',
  add column if not exists result_count integer,
  add column if not exists searched_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_budget_range'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_budget_range check (
        (budget_min is null or budget_min >= 0)
        and (budget_max is null or budget_max >= 0)
        and (budget_min is null or budget_max is null or budget_min <= budget_max)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_services_array'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_services_array
      check (jsonb_typeof(services) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_result_count_nonnegative'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_result_count_nonnegative
      check (result_count is null or result_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_status_allowed'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_status_allowed
      check (status in ('new', 'searched', 'failed', 'completed', 'cancelled'));
  end if;
end
$$;

create index if not exists requests_status_created_idx
  on public.requests (status, created_at desc);

revoke all on table public.requests from anon, authenticated;

comment on table public.requests is
  'Private normalized user requests. Server-side secret key access only until authentication ships.';
