-- Live Share housekeeping: host-triggered end + scheduled cleanup of expired rooms

-- Enable pg_cron for scheduled cleanup (idempotent)
create extension if not exists pg_cron;

-- Allow creators to delete their own rooms via standard DML (optional but useful)
drop policy if exists "live_share_rooms_creator_delete" on public.live_share_rooms;
create policy "live_share_rooms_creator_delete"
  on public.live_share_rooms for delete
  to authenticated
  using ((select auth.uid()) = created_by);

-- RPC for host to end a live share: deletes events then the room
create or replace function public.end_live_share(_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _creator uuid;
begin
  select created_by into _creator from public.live_share_rooms where id = _id;
  if _creator is null then
    -- Nothing to do
    return;
  end if;
  if auth.uid() is null or auth.uid() <> _creator then
    raise exception 'permission denied to end this live share';
  end if;

  -- Remove telemetry/events first (table owner bypasses RLS)
  delete from public.live_share_events where room_id = _id;
  -- Remove the room
  delete from public.live_share_rooms where id = _id;
end;
$$;

grant execute on function public.end_live_share(text) to authenticated;

-- Scheduled cleanup: purge expired rooms and their events
create or replace function public.purge_expired_live_shares()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _cutoff timestamptz := now();
  _count int := 0;
begin
  -- Delete events for rooms that are expired
  delete from public.live_share_events e
  using public.live_share_rooms r
  where e.room_id = r.id and r.expires_at is not null and r.expires_at < _cutoff;

  -- Delete the expired rooms
  delete from public.live_share_rooms r
  where r.expires_at is not null and r.expires_at < _cutoff;

  get diagnostics _count = row_count;
  return _count;
end;
$$;

-- Ensure a single cron job exists (unschedule previous if present), run every 10 minutes
do $$
begin
  begin
    perform cron.unschedule('purge_expired_live_shares');
  exception when others then
    null;
  end;
  perform cron.schedule('purge_expired_live_shares', '*/10 * * * *', 'select public.purge_expired_live_shares();');
end $$;


