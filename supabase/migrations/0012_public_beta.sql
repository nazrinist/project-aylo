alter table public.beta_participants
  add column if not exists access_mode text not null default 'closed';

alter table public.beta_participants
  alter column invite_fingerprint drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'beta_participants_access_mode_check'
      and conrelid = 'public.beta_participants'::regclass
  ) then
    alter table public.beta_participants
      add constraint beta_participants_access_mode_check check (
        (access_mode = 'closed' and invite_fingerprint is not null)
        or (access_mode = 'public' and invite_fingerprint is null)
      );
  end if;
end
$$;

create table if not exists public.beta_rate_limits (
  participant_id uuid not null
    references public.beta_participants(id) on delete cascade,
  action text not null check (
    action in (
      'intent',
      'search',
      'booking',
      'feedback',
      'search_providers',
      'check_availability'
    )
  ),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (participant_id, action)
);

alter table public.beta_rate_limits enable row level security;

revoke all on table public.beta_rate_limits from anon, authenticated;
grant select, insert, update on table public.beta_rate_limits to service_role;

create or replace function public.consume_beta_rate_limit(
  p_participant_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid beta rate limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid beta rate-limit window';
  end if;
  if p_action not in (
    'intent',
    'search',
    'booking',
    'feedback',
    'search_providers',
    'check_availability'
  ) then
    raise exception 'Invalid beta rate-limit action';
  end if;

  insert into public.beta_rate_limits (
    participant_id,
    action,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_participant_id,
    p_action,
    v_now,
    1,
    v_now
  )
  on conflict (participant_id, action) do update
  set
    window_started_at = case
      when v_now >= beta_rate_limits.window_started_at
        + make_interval(secs => p_window_seconds)
        then v_now
      else beta_rate_limits.window_started_at
    end,
    request_count = case
      when v_now >= beta_rate_limits.window_started_at
        + make_interval(secs => p_window_seconds)
        then 1
      else least(beta_rate_limits.request_count + 1, p_limit + 1)
    end,
    updated_at = v_now
  returning window_started_at, request_count
    into v_window_started_at, v_request_count;

  allowed := v_request_count <= p_limit;
  remaining := greatest(p_limit - v_request_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (
        v_window_started_at
          + make_interval(secs => p_window_seconds)
          - v_now
      )))::integer
    )
  end;
  return next;
end;
$$;

revoke all on function public.consume_beta_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_beta_rate_limit(uuid, text, integer, integer)
  to service_role;

comment on column public.beta_participants.access_mode is
  'Closed or public beta session; public sessions carry no invite fingerprint.';

comment on table public.beta_rate_limits is
  'Private per-session public-beta request counters; no IP address or user-agent data.';
