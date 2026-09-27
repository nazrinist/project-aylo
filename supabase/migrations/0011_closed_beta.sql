create table if not exists public.beta_participants (
  id uuid primary key,
  invite_fingerprint text not null
    check (invite_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.beta_participants(id),
  outcome text not null check (
    outcome in ('booking_created', 'useful_options', 'no_match', 'technical_issue')
  ),
  ease_rating smallint not null check (ease_rating between 1 and 5),
  comment text check (
    comment is null
    or (char_length(btrim(comment)) between 1 and 1000)
  ),
  created_at timestamptz not null default now()
);

create index if not exists beta_participants_created_idx
  on public.beta_participants (created_at desc);

create index if not exists beta_feedback_created_idx
  on public.beta_feedback (created_at desc);

create index if not exists beta_feedback_outcome_idx
  on public.beta_feedback (outcome, created_at desc);

alter table public.beta_participants enable row level security;
alter table public.beta_feedback enable row level security;

revoke all on table public.beta_participants from anon, authenticated;
revoke all on table public.beta_feedback from anon, authenticated;
grant select, insert on table public.beta_participants to service_role;
grant select, insert on table public.beta_feedback to service_role;

comment on table public.beta_participants is
  'Pseudonymous closed-beta browser participants; no email, IP, or user-agent data.';

comment on table public.beta_feedback is
  'Private structured beta outcomes and optional user comments, accessible server-side only.';
