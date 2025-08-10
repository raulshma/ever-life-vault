-- Create dashboard_layouts table and RLS policies
create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  layout_tree jsonb not null,
  widget_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_user_unique unique (user_id)
);

alter table public.dashboard_layouts enable row level security;

drop policy if exists "select_own_layout" on public.dashboard_layouts;
create policy "select_own_layout" on public.dashboard_layouts
  for select using ((SELECT auth.uid()) = user_id);

drop policy if exists "insert_own_layout" on public.dashboard_layouts;
create policy "insert_own_layout" on public.dashboard_layouts
  for insert with check ((SELECT auth.uid()) = user_id);

drop policy if exists "update_own_layout" on public.dashboard_layouts;
create policy "update_own_layout" on public.dashboard_layouts
  for update using ((SELECT auth.uid()) = user_id) with check ((SELECT auth.uid()) = user_id);

create index if not exists idx_dashboard_layouts_user on public.dashboard_layouts(user_id);


