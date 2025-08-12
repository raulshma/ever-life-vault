-- Create a generic per-user configuration store
create table if not exists public.user_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  namespace text not null check (char_length(namespace) <= 64),
  key text not null check (char_length(key) <= 128),
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, namespace, key)
);

-- Enable RLS
alter table public.user_configs enable row level security;

-- Policies: user can CRUD only their own rows
drop policy if exists "user_configs_select_own" on public.user_configs;
create policy "user_configs_select_own" on public.user_configs
  for select using ((SELECT auth.uid()) = user_id);

drop policy if exists "user_configs_insert_own" on public.user_configs;
create policy "user_configs_insert_own" on public.user_configs
  for insert with check ((SELECT auth.uid()) = user_id);

drop policy if exists "user_configs_update_own" on public.user_configs;
create policy "user_configs_update_own" on public.user_configs
  for update using ((SELECT auth.uid()) = user_id);

drop policy if exists "user_configs_delete_own" on public.user_configs;
create policy "user_configs_delete_own" on public.user_configs
  for delete using ((SELECT auth.uid()) = user_id);

-- Indexes for performance
create index if not exists idx_user_configs_user_ns on public.user_configs(user_id, namespace);
create index if not exists idx_user_configs_user_ns_key on public.user_configs(user_id, namespace, key);

-- Trigger for updated_at
create trigger update_user_configs_updated_at
  before update on public.user_configs
  for each row execute function public.update_updated_at_column();

comment on table public.user_configs is 'Generic per-user namespaced configuration store';
comment on column public.user_configs.namespace is 'Logical grouping, e.g. settings, dashboard, mss';
comment on column public.user_configs.key is 'Config key within a namespace';
comment on column public.user_configs.value is 'Arbitrary JSON payload';


