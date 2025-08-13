-- MAL integration tables and policies (v0)

create table if not exists public.mal_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (user_id),
  mal_user_id bigint not null unique,
  mal_username text not null,
  display_name text,
  avatar_url text,
  mean_score numeric(4,2),
  days_watched numeric(6,2),
  linked_at timestamptz not null default now(),
  synced_at timestamptz
);
create index if not exists mal_accounts_user_id_idx on public.mal_accounts(user_id);

create table if not exists public.mal_anime (
  mal_id bigint primary key,
  title text not null,
  title_english text,
  main_picture jsonb,
  media_type text,
  start_date date,
  end_date date,
  status text,
  season_year int,
  season_name text,
  mean double precision,
  rank int,
  popularity int,
  genres jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mal_user_list_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  mal_id bigint not null references public.mal_anime(mal_id) on delete cascade,
  status text not null,
  score int,
  num_episodes_watched int,
  priority int,
  comments text,
  updated_at timestamptz,
  primary key (user_id, mal_id)
);
create index if not exists mal_user_list_entries_user_id_idx on public.mal_user_list_entries(user_id);

create table if not exists public.mal_watch_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  mal_id bigint not null,
  episode int not null,
  watched_at timestamptz not null,
  primary key (user_id, mal_id, episode)
);
create index if not exists mal_watch_history_user_id_idx on public.mal_watch_history(user_id);
create index if not exists mal_watch_history_watched_idx on public.mal_watch_history(watched_at desc);

-- Token storage (encrypted at rest, application-managed)
create table if not exists public.mal_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_encrypted text not null,
  refresh_encrypted text,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Recommendations table scaffold (for future v1)
create table if not exists public.mal_recommendations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mal_id bigint not null references public.mal_anime(mal_id) on delete cascade,
  source text not null,
  score double precision not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, mal_id, source)
);

-- RLS
alter table public.mal_accounts enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_accounts'
          and policyname = 'mal_accounts_own'
    ) then
        execute 'create policy mal_accounts_own on public.mal_accounts for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.mal_user_list_entries enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_user_list_entries'
          and policyname = 'mal_entries_own'
    ) then
        execute 'create policy mal_entries_own on public.mal_user_list_entries for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.mal_watch_history enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_watch_history'
          and policyname = 'mal_history_own'
    ) then
        execute 'create policy mal_history_own on public.mal_watch_history for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.mal_recommendations enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_recommendations'
          and policyname = 'mal_recs_own'
    ) then
        execute 'create policy mal_recs_own on public.mal_recommendations for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.mal_tokens enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_tokens'
          and policyname = 'mal_tokens_own'
    ) then
        execute 'create policy mal_tokens_own on public.mal_tokens for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;


