create table if not exists public.live_share_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  event text not null, -- join | leave | chat | error | retry | fail
  peer_id text,
  encryption_enabled boolean,
  created_at timestamptz not null default now()
);

alter table public.live_share_events enable row level security;

create policy "live_share_events_insert_anon"
  on public.live_share_events for insert
  to anon, authenticated
  with check (true);

create policy "live_share_events_select_public"
  on public.live_share_events for select
  using (true);

grant select, insert on public.live_share_events to anon, authenticated;


