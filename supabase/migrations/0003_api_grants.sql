grant usage on schema public to anon, authenticated;

grant select on table
  public.businesses,
  public.services,
  public.availability
to anon, authenticated;

revoke all on table
  public.requests,
  public.offers,
  public.bookings,
  public.agent_runs
from anon, authenticated;

comment on schema public is
  'Public provider catalog is readable; user requests, bookings, offers and agent logs remain server-only.';
