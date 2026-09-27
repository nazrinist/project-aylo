alter table public.businesses
  add column if not exists source_url text,
  add column if not exists source_checked_at date,
  add column if not exists onboarding_status text not null default 'sample';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_onboarding_status_allowed'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_onboarding_status_allowed
      check (onboarding_status in ('sample', 'candidate', 'onboarded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_source_url_https'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_source_url_https
      check (
        source_url is null
        or (
          source_url ~ '^https://'
          and char_length(source_url) between 9 and 2048
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_source_date_requires_url'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_source_date_requires_url
      check (source_checked_at is null or source_url is not null);
  end if;
end
$$;

create index if not exists businesses_onboarding_status_name_idx
  on public.businesses (onboarding_status, name);

comment on column public.businesses.source_url is
  'Public listing used to discover or re-check a provider candidate.';

comment on column public.businesses.source_checked_at is
  'Last date the public source was manually checked; not a merchant verification date.';

comment on column public.businesses.onboarding_status is
  'sample = fictional MVP data, candidate = public lead, onboarded = merchant-reviewed profile.';
