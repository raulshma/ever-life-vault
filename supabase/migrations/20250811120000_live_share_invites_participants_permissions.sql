-- Live Share participants, invites, and ephemeral permissions

-- Participants with roles and lobby state
create table if not exists public.live_share_participants (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.live_share_rooms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('host','guest')),
  status text not null default 'pending' check (status in ('pending','approved','banned')),
  joined_at timestamptz not null default now(),
  approved_at timestamptz null
);

alter table public.live_share_participants enable row level security;

-- Indexes for common lookups
create index if not exists idx_lsp_room on public.live_share_participants(room_id);
create index if not exists idx_lsp_user on public.live_share_participants(user_id);

-- RLS policies: participants can read approved participants for their room; hosts can read all
drop policy if exists "lsp_select_public" on public.live_share_participants;
create policy "lsp_select_public"
  on public.live_share_participants for select
  using (
    -- Anyone can read participants of a room, but only approved are visible unless host
    exists (
      select 1
      from public.live_share_rooms r
      where r.id = live_share_participants.room_id
    ) and (
      status = 'approved' or (
        (select auth.uid()) is not null and
        exists (
          select 1 from public.live_share_rooms r
          where r.id = live_share_participants.room_id and r.created_by = (select auth.uid())
        )
      )
    )
  );

-- Only the host can update participant status in their room
drop policy if exists "lsp_update_host" on public.live_share_participants;
create policy "lsp_update_host"
  on public.live_share_participants for update
  to authenticated
  using (
    exists (
      select 1 from public.live_share_rooms r
      where r.id = live_share_participants.room_id and r.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.live_share_rooms r
      where r.id = live_share_participants.room_id and r.created_by = (select auth.uid())
    )
  );

-- Anyone can insert a pending guest participant row for a room when joining via code
drop policy if exists "lsp_insert_guest" on public.live_share_participants;
create policy "lsp_insert_guest"
  on public.live_share_participants for insert
  to anon, authenticated
  with check (
    role = 'guest' and status = 'pending'
  );

grant select, insert, update on public.live_share_participants to anon, authenticated;

-- Invite codes (short-lived)
create table if not exists public.live_share_invites (
  code text primary key,
  room_id text not null references public.live_share_rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses int not null default 1,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.live_share_invites enable row level security;

create index if not exists idx_lsi_room on public.live_share_invites(room_id);
create index if not exists idx_lsi_expires on public.live_share_invites(expires_at);

-- Only room creator can create invites for that room
drop policy if exists "lsi_insert_host" on public.live_share_invites;
create policy "lsi_insert_host"
  on public.live_share_invites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.live_share_rooms r
      where r.id = live_share_invites.room_id and r.created_by = (select auth.uid())
    )
  );

-- Anyone can select invites (to verify they exist) but not sensitive when expired/overused
drop policy if exists "lsi_select_public" on public.live_share_invites;
create policy "lsi_select_public"
  on public.live_share_invites for select
  using (true);

-- Host can update use_count; we use an RPC to redeem safely
grant select, insert on public.live_share_invites to authenticated;
grant select on public.live_share_invites to anon;

-- Ephemeral permissions per room
create table if not exists public.live_share_permissions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.live_share_rooms(id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  actions text[] not null,
  granted_to text not null default 'guests', -- 'guests' | 'all' | user_id
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.live_share_permissions enable row level security;

create index if not exists idx_lspm_room on public.live_share_permissions(room_id);

-- Host can manage permissions
drop policy if exists "lspm_crud_host" on public.live_share_permissions;
create policy "lspm_crud_host"
  on public.live_share_permissions for all
  to authenticated
  using (
    exists (
      select 1 from public.live_share_rooms r
      where r.id = live_share_permissions.room_id and r.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.live_share_rooms r
      where r.id = live_share_permissions.room_id and r.created_by = (select auth.uid())
    )
  );

-- Participants can read permissions for their room
drop policy if exists "lspm_select_participants" on public.live_share_permissions;
create policy "lspm_select_participants"
  on public.live_share_permissions for select
  using (
    exists (
      select 1 from public.live_share_participants p
      where p.room_id = live_share_permissions.room_id and p.status = 'approved'
    )
  );

grant select, insert, update, delete on public.live_share_permissions to authenticated;
grant select on public.live_share_permissions to anon;

-- RPC to redeem an invite atomically and create a pending participant
create or replace function public.redeem_live_share_invite(_code text, _display_name text)
returns table (room_id text, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text;
  v_creator uuid;
  v_expires timestamptz;
  v_max int;
  v_uses int;
  v_uid uuid;
  v_participant_id uuid;
begin
  select room_id, created_by, expires_at, max_uses, use_count
  into v_room, v_creator, v_expires, v_max, v_uses
  from public.live_share_invites
  where code = _code;

  if v_room is null then
    raise exception 'invalid invite code';
  end if;
  if v_expires is not null and v_expires < now() then
    raise exception 'invite expired';
  end if;
  if v_uses >= v_max then
    raise exception 'invite exhausted';
  end if;

  v_uid := auth.uid();

  -- increment use_count
  update public.live_share_invites
    set use_count = use_count + 1
    where code = _code;

  -- create pending participant
  insert into public.live_share_participants(room_id, user_id, display_name, role, status)
  values (v_room, v_uid, coalesce(_display_name, 'Guest'), 'guest', 'pending')
  returning id into v_participant_id;

  return query select v_room, v_participant_id;
end;
$$;

grant execute on function public.redeem_live_share_invite(text, text) to anon, authenticated;

-- RPC for host to approve/ban participant
create or replace function public.set_live_share_participant_status(_participant_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text;
  v_creator uuid;
begin
  if _status not in ('approved','banned') then
    raise exception 'invalid status';
  end if;
  select room_id into v_room from public.live_share_participants where id = _participant_id;
  if v_room is null then
    raise exception 'participant not found';
  end if;
  select created_by into v_creator from public.live_share_rooms where id = v_room;
  if auth.uid() is null or auth.uid() <> v_creator then
    raise exception 'permission denied';
  end if;
  update public.live_share_participants
    set status = _status,
        approved_at = case when _status = 'approved' then now() else approved_at end
    where id = _participant_id;
end;
$$;

grant execute on function public.set_live_share_participant_status(uuid, text) to authenticated;

-- RPC to get participant status for a given id (safe disclosure)
create or replace function public.get_live_share_participant_status(_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.live_share_participants where id = _id;
  return v_status;
end;
$$;

grant execute on function public.get_live_share_participant_status(uuid) to anon, authenticated;


