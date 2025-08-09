-- Create a safe public view exposing only non-sensitive room fields
create or replace view public.live_share_rooms_public as
select id, max_peers, locked, created_by, expires_at, created_at, password_salt
from public.live_share_rooms;

-- Revoke direct table select from anon; keep for authenticated
revoke select on public.live_share_rooms from anon;
grant select on public.live_share_rooms to authenticated;

-- Allow anon to read from the safe view
grant select on public.live_share_rooms_public to anon;
grant select on public.live_share_rooms_public to authenticated;


