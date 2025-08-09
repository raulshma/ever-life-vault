-- Ensure the public view runs with invoker rights so RLS is evaluated
-- for the querying role (PostgreSQL 15+).
alter view if exists public.live_share_rooms_public
  set (security_invoker = true);

-- With security_invoker=true, invokers must have SELECT on the
-- underlying columns referenced by the view. Grant column-level
-- privileges (not full-table) matching the view's projection.
grant select (id, max_peers, locked, created_by, expires_at, created_at, password_salt)
  on table public.live_share_rooms to anon;
grant select (id, max_peers, locked, created_by, expires_at, created_at, password_salt)
  on table public.live_share_rooms to authenticated;

-- Keep explicit grants on the view for clarity (optional but harmless).
grant select on public.live_share_rooms_public to anon;
grant select on public.live_share_rooms_public to authenticated;


