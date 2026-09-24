alter table public.agent_runs
  add column if not exists trace_id uuid,
  add column if not exists operation text not null default 'legacy',
  add column if not exists source text not null default 'unknown',
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists error_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_runs_operation_allowed'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_operation_allowed
      check (operation in ('legacy', 'intent_extraction', 'provider_search'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_runs_source_allowed'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_source_allowed
      check (source in ('unknown', 'openai', 'demo', 'supabase'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_runs_latency_nonnegative'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_latency_nonnegative
      check (latency_ms is null or latency_ms >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_runs_tokens_nonnegative'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_tokens_nonnegative
      check (
        (input_tokens is null or input_tokens >= 0)
        and (output_tokens is null or output_tokens >= 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_runs_error_code_format'
      and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs
      add constraint agent_runs_error_code_format
      check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$');
  end if;
end
$$;

create unique index if not exists agent_runs_trace_id_unique_idx
  on public.agent_runs (trace_id)
  where trace_id is not null;

create index if not exists agent_runs_operation_created_idx
  on public.agent_runs (operation, created_at desc);

create index if not exists agent_runs_request_created_idx
  on public.agent_runs (request_id, created_at desc)
  where request_id is not null;

revoke all on table public.agent_runs from anon, authenticated;

comment on table public.agent_runs is
  'Private, server-only operational telemetry. Never stores prompts, request text, cookies, secrets, or model output.';
comment on column public.agent_runs.trace_id is
  'Opaque correlation ID returned in the X-Aylo-Trace-Id response header.';
comment on column public.agent_runs.error_code is
  'Stable safe category only; raw error messages are not persisted.';
