create table if not exists public.live_share_rooms (
  id text primary key,
  max_peers smallint not null check (max_peers >= 2 and max_peers <= 8),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  password_salt text,
  password_proof text,
  expires_at timestamptz,
  locked boolean not null default false
);

alter table public.live_share_rooms enable row level security;

-- Anyone (including anon) can read room configs
create policy "live_share_rooms_public_select"
  on public.live_share_rooms for select
  using (true);

-- Only authenticated users can create a room config; once created, it cannot be updated/deleted
create policy "live_share_rooms_authenticated_insert"
  on public.live_share_rooms for insert
  to authenticated
  with check (true);

revoke all on public.live_share_rooms from anon;
grant select on public.live_share_rooms to anon;
grant select, insert on public.live_share_rooms to authenticated;

