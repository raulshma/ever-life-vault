-- Allow room creators to update the locked flag and auto-populate created_by on insert

-- Ensure created_by is set to the current user on insert when not provided
create or replace function public.set_live_share_created_by()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_live_share_created_by on public.live_share_rooms;
create trigger set_live_share_created_by
before insert on public.live_share_rooms
for each row execute function public.set_live_share_created_by();

-- Grant column-level update on locked to authenticated users
grant update (locked) on public.live_share_rooms to authenticated;

-- RLS policy: only the creator can update, and only rows they own
drop policy if exists "live_share_rooms_creator_update_locked" on public.live_share_rooms;
create policy "live_share_rooms_creator_update_locked"
  on public.live_share_rooms for update
  to authenticated
  using ((SELECT auth.uid()) = created_by)
  with check ((SELECT auth.uid()) = created_by);


